#!/usr/bin/env bash
# Checks that WINGET_TOKEN can publish through the Artexis10/winget-pkgs fork:
# GitHub accepts it, it belongs to the fork owner, it is a classic token with a
# scope that can write public repositories, and it does not expire within the
# number of days given as the first argument (0 skips the expiry check).
#
# The fork's `permissions` field reports the account's role, not the token's
# scopes, so a token with no scopes passed the old check and failed at the
# fork sync with HTTP 404.
set -euo pipefail

fork_owner=Artexis10
min_days="${1:-0}"

if [ -z "${WINGET_TOKEN:-}" ]; then
    echo "::error::The WINGET_TOKEN secret is empty. Add a classic token with the public_repo scope."
    exit 1
fi

headers=$(mktemp)
trap 'rm -f "$headers"' EXIT

# Only the status, the headers and the account name are read; the token is never written.
status=$(curl -sS -D "$headers" -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $WINGET_TOKEN" https://api.github.com/user)
if [ "$status" != "200" ]; then
    echo "::error::GitHub rejected WINGET_TOKEN (HTTP $status). The token may have expired: replace the WINGET_TOKEN secret."
    exit 1
fi

# An absent header prints nothing: a fine-grained token sends no scopes, and a
# token without an expiry date sends no expiry.
header() {
    { tr -d '\r' < "$headers" | grep -i "^$1:" || true; } | head -n 1 | sed 's/^[^:]*:[[:space:]]*//'
}

login=$(GH_TOKEN="$WINGET_TOKEN" gh api user --jq '.login')
if [ "$login" != "$fork_owner" ]; then
    echo "::error::WINGET_TOKEN belongs to '$login', not to $fork_owner, the owner of the winget-pkgs fork. Create the token on the $fork_owner account."
    exit 1
fi

# GitHub sends X-OAuth-Scopes only for classic tokens. `public_repo` and `repo`
# are GitHub's documented scopes that can write a public repository.
scopes=$(header x-oauth-scopes)
case ",${scopes// /}," in
    *,public_repo,* | *,repo,*) ;;
    *)
        echo "::error::WINGET_TOKEN cannot write to public repositories (scopes: '${scopes:-none}'). Edit the classic token on GitHub and tick public_repo; the token value stays the same."
        exit 1
        ;;
esac

expiry=$(header github-authentication-token-expiration)
if [ -z "$expiry" ]; then
    echo "WINGET_TOKEN belongs to $fork_owner, has the scopes '$scopes' and no expiry date."
    exit 0
fi
days_left=$(( ($(date -u -d "$expiry" +%s) - $(date -u +%s)) / 86400 ))
if [ "$days_left" -lt "$min_days" ]; then
    echo "::error::WINGET_TOKEN expires on $expiry, in $days_left days. Replace the WINGET_TOKEN secret now."
    exit 1
fi
echo "WINGET_TOKEN belongs to $fork_owner, has the scopes '$scopes' and expires on $expiry, in $days_left days."
