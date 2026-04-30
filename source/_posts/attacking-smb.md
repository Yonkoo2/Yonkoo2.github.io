---
title: Attacking SMB
date: 2026-04-29 14:20:00
categories:
  - Attacking Common Services
tags:
  - SMB
  - Windows
  - Enumeration
  - Shares
  - Pentesting
type: CPTS
excerpt: A practical SMB attack playbook for enumeration, share access, null sessions, credential checks, and common misconfigurations.
---

SMB is one of the most important Windows services to understand during internal penetration tests. It exposes file shares, named pipes, authentication behavior, domain information, and often sensitive data left behind by users or administrators.

The goal during SMB testing is not only to list shares. The real goal is to answer four questions:

- What host and domain information can I learn?
- Can I authenticate anonymously or with discovered credentials?
- Which shares can I read or write?
- Can any discovered file, script, backup, or configuration help me move forward?

## Quick Reference

| Item | Value |
| --- | --- |
| Service | SMB / CIFS |
| Common ports | `139/tcp`, `445/tcp` |
| Main targets | Windows hosts, Samba servers, domain controllers, file servers |
| Useful tools | `nmap`, `smbclient`, `smbmap`, `enum4linux-ng`, `crackmapexec` / `netexec` |

## Enumeration

Start with service discovery and default NSE scripts:

```bash
nmap -Pn -sV -sC -p139,445 <target_ip>
```

Useful SMB-specific scripts:

```bash
nmap --script smb-os-discovery,smb-enum-shares,smb-enum-users -p445 <target_ip>
```

Look for:

- hostname
- domain or workgroup
- SMB signing status
- SMB version
- accessible shares
- anonymous access
- exposed user names

## Null Session Checks

Some SMB servers allow anonymous sessions. Always test this early:

```bash
smbclient -L //<target_ip>/ -N
```

If anonymous listing works, try connecting to interesting shares:

```bash
smbclient //<target_ip>/<share_name> -N
```

Inside `smbclient`, useful commands include:

```text
ls
cd <directory>
get <file>
recurse ON
prompt OFF
mget *
```

## Share Enumeration

`smbmap` is fast for checking permissions:

```bash
smbmap -H <target_ip>
```

With credentials:

```bash
smbmap -H <target_ip> -u '<user>' -p '<password>'
```

Pay attention to permission levels:

- `NO ACCESS`: cannot read the share
- `READ ONLY`: can list and download files
- `READ, WRITE`: can upload or modify files

Write access is especially important. It can sometimes lead to code execution if the share is used by scripts, scheduled tasks, web roots, or deployment workflows.

## Authenticated Access

If you have credentials, enumerate shares and users again:

```bash
smbclient -L //<target_ip>/ -U '<user>%<password>'
smbmap -H <target_ip> -u '<user>' -p '<password>'
```

Download interesting files:

```bash
smbclient //<target_ip>/<share> -U '<user>%<password>'
```

Search for:

- passwords in scripts
- backup files
- configuration files
- database connection strings
- SSH keys
- documents with usernames or internal notes
- old deployment artifacts

## Recursive Looting

When a share is readable, pull it locally for offline review:

```bash
smbclient //<target_ip>/<share> -U '<user>%<password>' -c 'recurse ON; prompt OFF; mget *'
```

Then search locally:

```bash
grep -RniE 'password|passwd|pwd|secret|key|token|user|admin' .
```

## SMB Signing

SMB signing matters for relay attacks. Check it with Nmap:

```bash
nmap --script smb2-security-mode -p445 <target_ip>
```

If signing is disabled or not required, the host may be vulnerable to NTLM relay in the right network conditions.

## Common Findings

Common SMB weaknesses include:

1. Anonymous share access.
2. Sensitive files in readable shares.
3. Write access to operational shares.
4. Weak or reused credentials.
5. SMB signing not required.
6. Legacy SMB versions enabled.
7. Passwords inside scripts, backups, or config files.

## PDF Reference Captures

These snippets were extracted from the original SMB PDF notes and kept as visual references.

![SMB PDF reference 1](/images/smb-pdf/page-01-01.jpg)

![SMB PDF reference 2](/images/smb-pdf/page-01-02.jpg)

![SMB PDF reference 3](/images/smb-pdf/page-08-01.jpg)

![SMB PDF reference 4](/images/smb-pdf/page-12-02.jpg)

## Checklist

```text
[ ] Scan ports 139 and 445
[ ] Identify hostname/domain/workgroup
[ ] Check anonymous share listing
[ ] Enumerate shares with smbclient and smbmap
[ ] Test discovered credentials
[ ] Download readable shares
[ ] Search files for secrets
[ ] Check SMB signing
[ ] Check write access impact
[ ] Record useful users, paths, and credentials
```

## Takeaway

SMB is often a pivot point. Even when it does not provide direct execution, it frequently exposes the information needed for the next step: usernames, passwords, scripts, backups, or internal paths. Treat every readable share as a source of intelligence.
