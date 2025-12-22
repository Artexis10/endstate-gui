import { 
  Package, 
  Chrome, 
  Code, 
  FileText, 
  Terminal,
  Music,
  Image,
  Video,
  MessageSquare,
  Database,
  Cloud,
  Zap,
  Box
} from 'lucide-react';

export const APP_ICON_MAP: Record<string, typeof Package> = {
  'Google.Chrome': Chrome,
  'Microsoft.VisualStudioCode': Code,
  'Microsoft.VisualStudio.2022.Community': Code,
  'Git.Git': Terminal,
  'Microsoft.PowerShell': Terminal,
  'Microsoft.WindowsTerminal': Terminal,
  'Adobe.Acrobat.Reader.64-bit': FileText,
  'Notepad++.Notepad++': FileText,
  'Spotify.Spotify': Music,
  'VideoLAN.VLC': Video,
  'GIMP.GIMP': Image,
  'Mozilla.Firefox': Chrome,
  'Microsoft.Edge': Chrome,
  'Brave.Brave': Chrome,
  'Opera.Opera': Chrome,
  'Postman.Postman': Zap,
  'Insomnia.Insomnia': Zap,
  'Docker.DockerDesktop': Box,
  'Microsoft.Teams': MessageSquare,
  'Slack.Slack': MessageSquare,
  'Discord.Discord': MessageSquare,
  'Zoom.Zoom': Video,
  'Microsoft.OneDrive': Cloud,
  'Dropbox.Dropbox': Cloud,
  'PostgreSQL.PostgreSQL': Database,
  'MongoDB.Server': Database,
  'Oracle.MySQL': Database,
};

export function getAppIcon(wingetId: string): typeof Package {
  return APP_ICON_MAP[wingetId] || Package;
}
