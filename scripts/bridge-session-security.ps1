param(
    [Parameter(Mandatory = $true)][ValidateSet('CreateDirectory', 'ProtectFile', 'Verify')][string]$Action,
    [Parameter(Mandatory = $true)][string]$Target
)
$ErrorActionPreference = 'Stop'
$owner = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
$createdDirectory = $false
try {
    if ($Action -eq 'CreateDirectory') {
        # CreateDirectory receives the protected DACL atomically, before the path exists.
        Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class BridgeDirectory {
    [StructLayout(LayoutKind.Sequential)]
    public struct SecurityAttributes { public int Length; public IntPtr Descriptor; public int Inherit; }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CreateDirectory(string path, ref SecurityAttributes attributes);
}
'@
        $security = New-Object System.Security.AccessControl.DirectorySecurity
        $security.SetOwner($owner)
        $security.SetAccessRuleProtection($true, $false)
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($owner, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $security.AddAccessRule($rule)
        $bytes = $security.GetSecurityDescriptorBinaryForm()
        $memory = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
        try {
            [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $memory, $bytes.Length)
            $attributes = New-Object BridgeDirectory+SecurityAttributes
            $attributes.Length = [System.Runtime.InteropServices.Marshal]::SizeOf($attributes)
            $attributes.Descriptor = $memory
            if (-not [BridgeDirectory]::CreateDirectory($Target, [ref]$attributes)) {
                throw 'Could not create a private bridge session directory'
            }
            $createdDirectory = $true
        } finally { [System.Runtime.InteropServices.Marshal]::FreeHGlobal($memory) }
    } elseif ($Action -eq 'ProtectFile') {
        $security = Get-Acl -LiteralPath $Target
        $security.SetOwner($owner)
        $security.SetAccessRuleProtection($true, $true)
        Set-Acl -LiteralPath $Target -AclObject $security
    }
    $item = Get-Item -LiteralPath $Target -Force
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Session storage cannot be a reparse point' }
    $acl = Get-Acl -LiteralPath $Target
    if (-not $acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Equals($owner)) { throw 'Unexpected session storage owner' }
    if (-not $acl.AreAccessRulesProtected) { throw 'Session DACL must be protected' }
    $rules = $acl.GetAccessRules($true, $true, [System.Security.Principal.SecurityIdentifier])
    $ownerAccess = $false
    foreach ($rule in $rules) {
        if ($rule.AccessControlType -ne [System.Security.AccessControl.AccessControlType]::Allow -or
            -not $rule.IdentityReference.Equals($owner) -or $rule.IsInherited) { throw 'Unexpected session DACL trustee or access rule' }
        if (($rule.FileSystemRights -band [System.Security.AccessControl.FileSystemRights]::FullControl) -eq [System.Security.AccessControl.FileSystemRights]::FullControl) { $ownerAccess = $true }
    }
    if (-not $ownerAccess) { throw 'Session owner must have full control' }
} catch {
    if ($createdDirectory) { [System.IO.Directory]::Delete($Target) }
    throw
}
