import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useITAssets } from '@/hooks/useITAssets';
import { useAuth } from '@/contexts/AuthContext';
import { Download, Copy, Terminal, CheckCircle, XCircle, Clock, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

const SUPABASE_URL = "https://fnmkczsvwpzpxyklztkt.supabase.co";

export function AgentManagement() {
  const { agents, loadAgents } = useITAssets();
  const { userProfile } = useAuth();
  const defaultTab = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? 'linux' : 'windows';
  const [scriptTab, setScriptTab] = useState(defaultTab);

  const hasOrgId = Boolean(userProfile?.organization_id);
  const orgId = userProfile?.organization_id || '';

  const windowsScript = `# TopSqill IT Asset Agent - Windows PowerShell
# Run as Administrator

$API_URL = "${SUPABASE_URL}/functions/v1/asset-agent-report"
$ORG_ID = "${orgId}"
$AGENT_KEY = "$env:COMPUTERNAME-$(Get-WmiObject Win32_BIOS | Select-Object -ExpandProperty SerialNumber)"

function Send-AgentReport {
    param([string]$Action, [hashtable]$Body)
    $Body["action"] = $Action
    $headers = @{ "x-agent-key" = $AGENT_KEY; "Content-Type" = "application/json" }
    try {
        $response = Invoke-RestMethod -Uri $API_URL -Method POST -Headers $headers -Body ($Body | ConvertTo-Json -Depth 10) -ErrorAction Stop
        Write-Host "[$Action] Success: $($response | ConvertTo-Json -Compress)"
        return $response
    } catch {
        Write-Host "[$Action] Error: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Register
$os = Get-CimInstance Win32_OperatingSystem
Send-AgentReport -Action "register" -Body @{
    organization_id = $ORG_ID
    hostname = $env:COMPUTERNAME
    os_type = "Windows"
    os_version = $os.Caption
}

# Collect Hardware
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$cs = Get-CimInstance Win32_ComputerSystem
$bios = Get-CimInstance Win32_BIOS
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Measure-Object Size, FreeSpace -Sum
$gpu = Get-CimInstance Win32_VideoController | Select-Object -First 1
$mb = Get-CimInstance Win32_BaseBoard
$nics = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled } | ForEach-Object {
    @{ name = $_.Description; mac = $_.MACAddress; ip = ($_.IPAddress | Select-Object -First 1) }
}
$ipAddr = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback" } | Select-Object -First 1).IPAddress
$macAddr = (Get-NetAdapter | Where-Object { $_.Status -eq "Up" } | Select-Object -First 1).MacAddress

$hardware = @{
    cpu_model = $cpu.Name
    cpu_cores = $cpu.NumberOfCores
    cpu_speed_mhz = $cpu.MaxClockSpeed
    ram_total_gb = [math]::Round($cs.TotalPhysicalMemory / 1GB, 2)
    disk_total_gb = [math]::Round($disk.Sum[0] / 1GB, 2)
    disk_free_gb = [math]::Round($disk.Sum[1] / 1GB, 2)
    gpu_model = $gpu.Name
    os_name = $os.Caption
    os_version = $os.Version
    os_architecture = $os.OSArchitecture
    bios_version = $bios.SMBIOSBIOSVersion
    motherboard_model = "$($mb.Manufacturer) $($mb.Product)"
    network_adapters = @($nics)
    last_boot_time = $os.LastBootUpTime.ToString("o")
    uptime_hours = [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalHours, 2)
}

# Collect Software
$software = Get-ItemProperty "HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*",
    "HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName } | ForEach-Object {
    @{
        name = $_.DisplayName
        version = $_.DisplayVersion
        publisher = $_.Publisher
        install_date = if ($_.InstallDate) { 
            try { [datetime]::ParseExact($_.InstallDate, "yyyyMMdd", $null).ToString("yyyy-MM-dd") } catch { $null }
        } else { $null }
        size_mb = if ($_.EstimatedSize) { [math]::Round($_.EstimatedSize / 1024, 2) } else { $null }
        is_system_component = [bool]$_.SystemComponent
    }
}

# Send full report
Send-AgentReport -Action "report" -Body @{
    system = @{
        hostname = $env:COMPUTERNAME
        ip_address = $ipAddr
        mac_address = $macAddr
        manufacturer = $cs.Manufacturer
        model = $cs.Model
        serial_number = $bios.SerialNumber
    }
    hardware = $hardware
    software = @($software)
}

Write-Host "Agent report completed successfully!" -ForegroundColor Green`;

  const linuxScript = `#!/bin/bash
# TopSqill IT Asset Agent - Linux/macOS
# Run with sudo

API_URL="${SUPABASE_URL}/functions/v1/asset-agent-report"
ORG_ID="${orgId}"
HOSTNAME_VAL=$(hostname)
SERIAL=$(sudo dmidecode -s system-serial-number 2>/dev/null || echo "unknown")
AGENT_KEY="\${HOSTNAME_VAL}-\${SERIAL}"

send_report() {
    local action=$1
    local body=$2
    curl -s -X POST "$API_URL" \\
        -H "Content-Type: application/json" \\
        -H "x-agent-key: $AGENT_KEY" \\
        -d "$body"
}

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS_TYPE="macOS"
    OS_VERSION=$(sw_vers -productVersion)
    CPU_MODEL=$(sysctl -n machdep.cpu.brand_string)
    CPU_CORES=$(sysctl -n hw.ncpu)
    CPU_SPEED=$(sysctl -n hw.cpufrequency 2>/dev/null || echo "0")
    RAM_GB=$(echo "scale=2; $(sysctl -n hw.memsize) / 1073741824" | bc)
    DISK_TOTAL=$(df -g / | tail -1 | awk '{print $2}')
    DISK_FREE=$(df -g / | tail -1 | awk '{print $4}')
    MANUFACTURER="Apple"
    MODEL=$(sysctl -n hw.model)
    IP_ADDR=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
    MAC_ADDR=$(ifconfig en0 2>/dev/null | awk '/ether/{print $2}')
else
    OS_TYPE="Linux"
    OS_VERSION=$(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2)
    CPU_MODEL=$(grep "model name" /proc/cpuinfo | head -1 | cut -d':' -f2 | xargs)
    CPU_CORES=$(nproc)
    CPU_SPEED=$(grep "cpu MHz" /proc/cpuinfo | head -1 | awk '{print int($4)}')
    RAM_GB=$(echo "scale=2; $(grep MemTotal /proc/meminfo | awk '{print $2}') / 1048576" | bc)
    DISK_TOTAL=$(df -BG / | tail -1 | awk '{print int($2)}')
    DISK_FREE=$(df -BG / | tail -1 | awk '{print int($4)}')
    MANUFACTURER=$(sudo dmidecode -s system-manufacturer 2>/dev/null || echo "Unknown")
    MODEL=$(sudo dmidecode -s system-product-name 2>/dev/null || echo "Unknown")
    IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}')
    MAC_ADDR=$(ip link show | grep link/ether | head -1 | awk '{print $2}')
fi

GPU_MODEL=$(lspci 2>/dev/null | grep VGA | cut -d':' -f3 | xargs || echo "")
BIOS_VER=$(sudo dmidecode -s bios-version 2>/dev/null || echo "")
BOARD=$(sudo dmidecode -s baseboard-product-name 2>/dev/null || echo "")
UPTIME_HOURS=$(echo "scale=2; $(cat /proc/uptime 2>/dev/null | awk '{print $1}' || echo 0) / 3600" | bc 2>/dev/null || echo "0")

# Register
send_report "register" "$(cat <<EOF
{
    "action": "register",
    "organization_id": "$ORG_ID",
    "hostname": "$HOSTNAME_VAL",
    "os_type": "$OS_TYPE",
    "os_version": "$OS_VERSION"
}
EOF
)"

# Collect software list
if [[ "$OSTYPE" == "darwin"* ]]; then
    SOFTWARE=$(system_profiler SPApplicationsDataType -json 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
apps = data.get('SPApplicationsDataType', [])
result = []
for app in apps[:200]:
    result.append({'name': app.get('_name',''), 'version': app.get('version',''), 'path': app.get('path','')})
print(json.dumps(result))" 2>/dev/null || echo "[]")
else
    SOFTWARE=$(dpkg-query -W -f='{"name":"\${Package}","version":"\${Version}"},' 2>/dev/null | sed 's/,$//' | awk 'BEGIN{print "["}{print}END{print "]"}' 2>/dev/null || 
              rpm -qa --queryformat '{"name":"%{NAME}","version":"%{VERSION}"},' 2>/dev/null | sed 's/,$//' | awk 'BEGIN{print "["}{print}END{print "]"}' 2>/dev/null || echo "[]")
fi

# Send report
send_report "report" "$(cat <<EOF
{
    "action": "report",
    "system": {
        "hostname": "$HOSTNAME_VAL",
        "ip_address": "$IP_ADDR",
        "mac_address": "$MAC_ADDR",
        "manufacturer": "$MANUFACTURER",
        "model": "$MODEL",
        "serial_number": "$SERIAL"
    },
    "hardware": {
        "cpu_model": "$CPU_MODEL",
        "cpu_cores": $CPU_CORES,
        "cpu_speed_mhz": $CPU_SPEED,
        "ram_total_gb": $RAM_GB,
        "disk_total_gb": $DISK_TOTAL,
        "disk_free_gb": $DISK_FREE,
        "gpu_model": "$GPU_MODEL",
        "os_name": "$OS_TYPE",
        "os_version": "$OS_VERSION",
        "os_architecture": "$(uname -m)",
        "bios_version": "$BIOS_VER",
        "motherboard_model": "$BOARD",
        "uptime_hours": $UPTIME_HOURS
    },
    "software": $SOFTWARE
}
EOF
)"

echo "Agent report completed successfully!"`;

  const copyScript = (script: string) => {
    navigator.clipboard.writeText(script);
    toast({ title: 'Copied!', description: 'Agent script copied to clipboard.' });
  };

  const downloadScript = (script: string, filename: string) => {
    const blob = new Blob([script], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getAgentStatusIcon = (agent: any) => {
    const isOnline = agent.status === 'online' && agent.last_heartbeat &&
      new Date(agent.last_heartbeat) > new Date(Date.now() - 5 * 60 * 1000);
    return isOnline ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />;
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Agent Script Download */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Terminal className="h-5 w-5" />Agent Installation</CardTitle>
          <CardDescription className="space-y-1">
            <p>Download and run the agent script on each system to automatically collect hardware and software inventory.</p>
            <p>The agent can be deployed via Group Policy (GPO), SCCM, or manually.</p>
            <p><strong>Organization ID used in scripts:</strong> {orgId || 'Loading...'}</p>
            {!hasOrgId && (
              <p><strong>Wait for profile to load</strong> before copying/downloading, then refresh this page.</p>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={scriptTab} onValueChange={setScriptTab}>
            <TabsList>
              <TabsTrigger value="windows">Windows (PowerShell)</TabsTrigger>
              <TabsTrigger value="linux">macOS / Linux (Bash)</TabsTrigger>
            </TabsList>

            <TabsContent value="windows" className="space-y-3">
              <div className="bg-muted rounded-lg p-4 max-h-[300px] overflow-y-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap">{windowsScript.slice(0, 500)}...</pre>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={!hasOrgId} onClick={() => copyScript(windowsScript)}>
                  <Copy className="h-4 w-4 mr-2" />Copy Script
                </Button>
                <Button size="sm" disabled={!hasOrgId} onClick={() => downloadScript(windowsScript, 'topsqill-agent.ps1')}>
                  <Download className="h-4 w-4 mr-2" />Download .ps1
                </Button>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Manual:</strong> Run PowerShell as Administrator, then execute the script.</p>
                <p><strong>GPO Deploy:</strong> Create a startup script policy pointing to this .ps1 file.</p>
                <p><strong>Scheduled:</strong> Use Task Scheduler to run daily for continuous monitoring.</p>
              </div>
            </TabsContent>

            <TabsContent value="linux" className="space-y-3">
              <div className="bg-muted rounded-lg p-4 max-h-[300px] overflow-y-auto">
                <pre className="text-xs font-mono whitespace-pre-wrap">{linuxScript.slice(0, 500)}...</pre>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => copyScript(linuxScript)}>
                  <Copy className="h-4 w-4 mr-2" />Copy Script
                </Button>
                <Button size="sm" onClick={() => downloadScript(linuxScript, 'topsqill-agent.sh')}>
                  <Download className="h-4 w-4 mr-2" />Download .sh
                </Button>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Manual:</strong> <code>chmod +x topsqill-agent.sh && sudo ./topsqill-agent.sh</code></p>
                <p><strong>Cron:</strong> Add to crontab for scheduled collection: <code>0 */6 * * * /path/to/topsqill-agent.sh</code></p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Registered Agents */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Registered Agents ({agents.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={loadAgents}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
          </div>
        </CardHeader>
        <CardContent>
          {agents.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No agents registered yet. Install the agent script on your systems to get started.</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Hostname</TableHead>
                    <TableHead>OS</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Last Heartbeat</TableHead>
                    <TableHead>Last Report</TableHead>
                    <TableHead>Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map(agent => (
                    <TableRow key={agent.id}>
                      <TableCell>{getAgentStatusIcon(agent)}</TableCell>
                      <TableCell className="font-medium">{agent.hostname || '-'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{agent.os_type || '-'}</Badge></TableCell>
                      <TableCell className="text-xs">{agent.agent_version}</TableCell>
                      <TableCell className="font-mono text-xs">{agent.ip_address || '-'}</TableCell>
                      <TableCell className="text-xs">
                        {agent.last_heartbeat ? formatDistanceToNow(new Date(agent.last_heartbeat), { addSuffix: true }) : 'Never'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {agent.last_report ? formatDistanceToNow(new Date(agent.last_report), { addSuffix: true }) : 'Never'}
                      </TableCell>
                      <TableCell className="text-xs">{format(new Date(agent.registered_at), 'MMM d, yyyy')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
