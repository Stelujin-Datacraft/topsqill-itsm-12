import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useITAssets } from '@/hooks/useITAssets';
import { useAuth } from '@/contexts/AuthContext';
import { Download, Copy, Terminal, CheckCircle, XCircle, Clock, RefreshCw, Wifi, WifiOff, LogIn, Zap } from 'lucide-react';
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

  const API_URL = `${SUPABASE_URL}/functions/v1/asset-agent-report`;

  const windowsQuickTest = `$API_URL = "${API_URL}"
$ORG_ID = "${orgId}"
$AGENT_KEY = "$env:COMPUTERNAME-QuickTest"
$headers = @{ "x-agent-key" = $AGENT_KEY; "Content-Type" = "application/json" }

# Register
$regBody = @{ action = "register"; organization_id = $ORG_ID; hostname = $env:COMPUTERNAME; os_type = "Windows"; os_version = (Get-CimInstance Win32_OperatingSystem).Version } | ConvertTo-Json
Invoke-RestMethod -Uri $API_URL -Method POST -Headers $headers -Body $regBody

# Report
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$os = Get-CimInstance Win32_OperatingSystem
$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" | Select-Object -First 1
$reportBody = @{
    action = "report"
    system = @{ hostname = $env:COMPUTERNAME; manufacturer = (Get-CimInstance Win32_ComputerSystem).Manufacturer; model = (Get-CimInstance Win32_ComputerSystem).Model }
    hardware = @{ cpu_model = $cpu.Name; cpu_cores = $cpu.NumberOfCores; ram_total_gb = [math]::Round($os.TotalVisibleMemorySize/1MB,1); disk_total_gb = [math]::Round($disk.Size/1GB,0); disk_free_gb = [math]::Round($disk.FreeSpace/1GB,0); os_name = "Windows"; os_version = $os.Version }
    software = @(@{ name = "Quick Test"; version = "1.0" })
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri $API_URL -Method POST -Headers $headers -Body $reportBody

Write-Host "Done! Refresh the Agents page to see your device." -ForegroundColor Green`;

  const macLinuxQuickTest = `HOSTNAME_VAL=$(hostname)
OS_TYPE=$(uname -s)
if [ "$OS_TYPE" = "Darwin" ]; then
  OS_TYPE="macOS"
  OS_VER=$(sw_vers -productVersion 2>/dev/null || echo "unknown")
  CPU_MODEL=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Unknown")
  CPU_CORES=$(sysctl -n hw.ncpu 2>/dev/null || echo 0)
  RAM_GB=$(echo "scale=0; $(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1073741824" | bc 2>/dev/null || echo 0)
  DISK_TOTAL=$(df -g / | tail -1 | awk '{print $2}')
  DISK_FREE=$(df -g / | tail -1 | awk '{print $4}')
  MODEL=$(sysctl -n hw.model 2>/dev/null || echo "Unknown")
  IP_ADDR=$(ipconfig getifaddr en0 2>/dev/null || echo "")
  MAC_ADDR=$(ifconfig en0 2>/dev/null | awk '/ether/{print $2}' || echo "")
  SERIAL=$(system_profiler SPHardwareDataType 2>/dev/null | awk '/Serial Number/{print $NF}' || echo "unknown")
else
  OS_VER=$(uname -r)
  CPU_MODEL=$(grep "model name" /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2 | xargs || echo "Unknown")
  CPU_CORES=$(nproc 2>/dev/null || echo 0)
  RAM_GB=$(echo "scale=0; $(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print $2}' || echo 0) / 1048576" | bc 2>/dev/null || echo 0)
  DISK_TOTAL=$(df -BG / | tail -1 | awk '{print int($2)}')
  DISK_FREE=$(df -BG / | tail -1 | awk '{print int($4)}')
  MODEL=$(cat /sys/devices/virtual/dmi/id/product_name 2>/dev/null || echo "Unknown")
  IP_ADDR=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "")
  MAC_ADDR=$(ip link show 2>/dev/null | grep link/ether | head -1 | awk '{print $2}' || echo "")
  SERIAL=$(cat /sys/devices/virtual/dmi/id/product_serial 2>/dev/null || echo "unknown")
fi
AGENT_KEY="quick-test-$HOSTNAME_VAL"

echo "Registering agent..."
curl -s -X POST "${API_URL}" \\
  -H "Content-Type: application/json" \\
  -H "x-agent-key: $AGENT_KEY" \\
  -d "{\\"action\\":\\"register\\",\\"organization_id\\":\\"${orgId}\\",\\"hostname\\":\\"$HOSTNAME_VAL\\",\\"os_type\\":\\"$OS_TYPE\\",\\"os_version\\":\\"$OS_VER\\"}"

echo ""
echo "Sending report..."
curl -s -X POST "${API_URL}" \\
  -H "Content-Type: application/json" \\
  -H "x-agent-key: $AGENT_KEY" \\
  -d "{\\"action\\":\\"report\\",\\"system\\":{\\"hostname\\":\\"$HOSTNAME_VAL\\",\\"ip_address\\":\\"$IP_ADDR\\",\\"mac_address\\":\\"$MAC_ADDR\\",\\"manufacturer\\":\\"Apple\\",\\"model\\":\\"$MODEL\\",\\"serial_number\\":\\"$SERIAL\\"},\\"hardware\\":{\\"cpu_model\\":\\"$CPU_MODEL\\",\\"cpu_cores\\":$CPU_CORES,\\"ram_total_gb\\":$RAM_GB,\\"disk_total_gb\\":$DISK_TOTAL,\\"disk_free_gb\\":$DISK_FREE,\\"os_name\\":\\"$OS_TYPE\\",\\"os_version\\":\\"$OS_VER\\"},\\"software\\":[{\\"name\\":\\"Quick Test\\",\\"version\\":\\"1.0\\"}]}"

echo ""
echo "Done! Refresh the Agents page to see your device."`;

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
# Run with: bash topsqill-agent.sh

API_URL="${SUPABASE_URL}/functions/v1/asset-agent-report"
ORG_ID="${orgId}"
HOSTNAME_VAL=\$(hostname)

send_report() {
    local action=\$1
    local body=\$2
    echo "[\$action] Sending..."
    RESULT=\$(curl -s -X POST "\$API_URL" \\
        -H "Content-Type: application/json" \\
        -H "x-agent-key: \$AGENT_KEY" \\
        -d "\$body")
    echo "[\$action] Response: \$RESULT"
}

# Get serial number
if [[ "\$OSTYPE" == "darwin"* ]]; then
    SERIAL=\$(system_profiler SPHardwareDataType 2>/dev/null | awk '/Serial Number/{print \$NF}' || echo "unknown")
else
    SERIAL=\$(sudo cat /sys/devices/virtual/dmi/id/product_serial 2>/dev/null || sudo dmidecode -s system-serial-number 2>/dev/null || echo "unknown")
fi
AGENT_KEY="\${HOSTNAME_VAL}-\${SERIAL}"

# Detect OS and collect hardware info
if [[ "\$OSTYPE" == "darwin"* ]]; then
    OS_TYPE="macOS"
    OS_VERSION=\$(sw_vers -productVersion)
    CPU_MODEL=\$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Apple Silicon")
    CPU_CORES=\$(sysctl -n hw.ncpu 2>/dev/null || echo 0)
    CPU_SPEED=\$(sysctl -n hw.cpufrequency 2>/dev/null)
    CPU_SPEED=\${CPU_SPEED:-0}
    CPU_SPEED_MHZ=\$(echo "\$CPU_SPEED / 1000000" | bc 2>/dev/null || echo 0)
    RAM_BYTES=\$(sysctl -n hw.memsize 2>/dev/null || echo 0)
    RAM_GB=\$(echo "scale=2; \$RAM_BYTES / 1073741824" | bc 2>/dev/null || echo 0)
    DISK_TOTAL=\$(df -g / | tail -1 | awk '{print \$2}')
    DISK_FREE=\$(df -g / | tail -1 | awk '{print \$4}')
    DISK_TOTAL=\${DISK_TOTAL:-0}
    DISK_FREE=\${DISK_FREE:-0}
    MANUFACTURER="Apple"
    MODEL=\$(sysctl -n hw.model 2>/dev/null || echo "Unknown")
    IP_ADDR=\$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
    MAC_ADDR=\$(ifconfig en0 2>/dev/null | awk '/ether/{print \$2}' || echo "")
    GPU_MODEL=\$(system_profiler SPDisplaysDataType 2>/dev/null | awk -F': ' '/Chipset Model/{print \$2}' | head -1 || echo "")
    BIOS_VER=""
    BOARD=""
    BOOT_TIME=\$(sysctl -n kern.boottime 2>/dev/null | awk '{print \$4}' | tr -d ',')
    NOW=\$(date +%s)
    if [ -n "\$BOOT_TIME" ] && [ "\$BOOT_TIME" -gt 0 ] 2>/dev/null; then
        UPTIME_HOURS=\$(echo "scale=2; (\$NOW - \$BOOT_TIME) / 3600" | bc 2>/dev/null || echo 0)
    else
        UPTIME_HOURS=0
    fi
else
    OS_TYPE="Linux"
    OS_VERSION=\$(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2 || echo "Linux")
    CPU_MODEL=\$(grep "model name" /proc/cpuinfo 2>/dev/null | head -1 | cut -d':' -f2 | xargs || echo "Unknown")
    CPU_CORES=\$(nproc 2>/dev/null || echo 0)
    CPU_SPEED_MHZ=\$(grep "cpu MHz" /proc/cpuinfo 2>/dev/null | head -1 | awk '{print int(\$4)}' || echo 0)
    RAM_KB=\$(grep MemTotal /proc/meminfo 2>/dev/null | awk '{print \$2}' || echo 0)
    RAM_GB=\$(echo "scale=2; \$RAM_KB / 1048576" | bc 2>/dev/null || echo 0)
    DISK_TOTAL=\$(df -BG / | tail -1 | awk '{print int(\$2)}')
    DISK_FREE=\$(df -BG / | tail -1 | awk '{print int(\$4)}')
    DISK_TOTAL=\${DISK_TOTAL:-0}
    DISK_FREE=\${DISK_FREE:-0}
    MANUFACTURER=\$(sudo dmidecode -s system-manufacturer 2>/dev/null || echo "Unknown")
    MODEL=\$(sudo dmidecode -s system-product-name 2>/dev/null || echo "Unknown")
    IP_ADDR=\$(hostname -I 2>/dev/null | awk '{print \$1}' || echo "")
    MAC_ADDR=\$(ip link show 2>/dev/null | grep link/ether | head -1 | awk '{print \$2}' || echo "")
    GPU_MODEL=\$(lspci 2>/dev/null | grep VGA | cut -d':' -f3 | xargs || echo "")
    BIOS_VER=\$(sudo dmidecode -s bios-version 2>/dev/null || echo "")
    BOARD=\$(sudo dmidecode -s baseboard-product-name 2>/dev/null || echo "")
    UPTIME_SEC=\$(cat /proc/uptime 2>/dev/null | awk '{print \$1}' || echo 0)
    UPTIME_HOURS=\$(echo "scale=2; \$UPTIME_SEC / 3600" | bc 2>/dev/null || echo 0)
fi

# Register
send_report "register" "{\\"action\\":\\"register\\",\\"organization_id\\":\\"\$ORG_ID\\",\\"hostname\\":\\"\$HOSTNAME_VAL\\",\\"os_type\\":\\"\$OS_TYPE\\",\\"os_version\\":\\"\$OS_VERSION\\"}"

echo ""

# Collect software list
if [[ "\$OSTYPE" == "darwin"* ]]; then
    SOFTWARE=\$(system_profiler SPApplicationsDataType -json 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
apps = data.get('SPApplicationsDataType', [])
result = []
for app in apps[:200]:
    result.append({'name': app.get('_name',''), 'version': app.get('version',''), 'path': app.get('path','')})
print(json.dumps(result))" 2>/dev/null || echo "[]")
else
    SOFTWARE=\$(dpkg-query -W -f='{"name":"\${Package}","version":"\${Version}"},' 2>/dev/null | sed 's/,\$//' | awk 'BEGIN{print "["}1{print}END{print "]"}' 2>/dev/null || 
              rpm -qa --queryformat '{"name":"%{NAME}","version":"%{VERSION}"},' 2>/dev/null | sed 's/,\$//' | awk 'BEGIN{print "["}1{print}END{print "]"}' 2>/dev/null || echo "[]")
fi

# Send full report
REPORT_JSON=\$(cat <<EOJSON
{
    "action": "report",
    "system": {
        "hostname": "\$HOSTNAME_VAL",
        "ip_address": "\$IP_ADDR",
        "mac_address": "\$MAC_ADDR",
        "manufacturer": "\$MANUFACTURER",
        "model": "\$MODEL",
        "serial_number": "\$SERIAL"
    },
    "hardware": {
        "cpu_model": "\$CPU_MODEL",
        "cpu_cores": \${CPU_CORES:-0},
        "cpu_speed_mhz": \${CPU_SPEED_MHZ:-0},
        "ram_total_gb": \${RAM_GB:-0},
        "disk_total_gb": \${DISK_TOTAL:-0},
        "disk_free_gb": \${DISK_FREE:-0},
        "gpu_model": "\$GPU_MODEL",
        "os_name": "\$OS_TYPE",
        "os_version": "\$OS_VERSION",
        "os_architecture": "\$(uname -m)",
        "bios_version": "\$BIOS_VER",
        "motherboard_model": "\$BOARD",
        "uptime_hours": \${UPTIME_HOURS:-0}
    },
    "software": \$SOFTWARE
}
EOJSON
)

send_report "report" "\$REPORT_JSON"

echo ""
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
          <CardDescription>
            Download and run the agent script on each device to automatically collect hardware & software inventory and report it here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasOrgId && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              ⏳ Loading your organization profile… Please wait before downloading.
            </div>
          )}

          <Tabs value={scriptTab} onValueChange={setScriptTab}>
            <TabsList>
              <TabsTrigger value="windows">Windows</TabsTrigger>
              <TabsTrigger value="linux">macOS / Linux</TabsTrigger>
            </TabsList>

            {/* ─── Windows ─── */}
            <TabsContent value="windows" className="space-y-4">
              <div className="flex gap-2">
                <Button size="sm" disabled={!hasOrgId} onClick={() => downloadScript(windowsScript, 'topsqill-agent.ps1')}>
                  <Download className="h-4 w-4 mr-2" />Download topsqill-agent.ps1
                </Button>
                <Button variant="outline" size="sm" disabled={!hasOrgId} onClick={() => copyScript(windowsScript)}>
                  <Copy className="h-4 w-4 mr-2" />Copy Script
                </Button>
              </div>

              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <h4 className="font-semibold text-sm">How to run (step-by-step)</h4>
                <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                  <li>Click <strong>"Download topsqill-agent.ps1"</strong> above.</li>
                  <li>Open <strong>PowerShell as Administrator</strong> — right-click the Start menu → "Windows PowerShell (Admin)".</li>
                  <li>Navigate to your Downloads folder:
                    <code className="block bg-muted rounded px-2 py-1 mt-1 font-mono text-xs">cd ~\Downloads</code>
                  </li>
                  <li>Allow running the script (one-time):
                    <code className="block bg-muted rounded px-2 py-1 mt-1 font-mono text-xs">Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass</code>
                  </li>
                  <li>Run the script:
                    <code className="block bg-muted rounded px-2 py-1 mt-1 font-mono text-xs">.\topsqill-agent.ps1</code>
                  </li>
                  <li>You should see <strong>"Agent report completed successfully!"</strong> — then refresh this page.</li>
                </ol>
              </div>

              <details className="text-sm text-muted-foreground">
                <summary className="cursor-pointer font-medium">Advanced deployment options</summary>
                <ul className="mt-2 space-y-1 list-disc list-inside ml-2">
                  <li><strong>GPO:</strong> Create a startup script policy pointing to this .ps1 file.</li>
                  <li><strong>Scheduled:</strong> Use Task Scheduler to run daily for continuous monitoring.</li>
                  <li><strong>SCCM/Intune:</strong> Deploy as a script package to managed devices.</li>
                </ul>
              </details>

              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground font-medium">View full script</summary>
                <div className="bg-muted rounded-lg p-3 mt-2 max-h-[250px] overflow-y-auto">
                  <pre className="font-mono whitespace-pre-wrap">{windowsScript}</pre>
                </div>
              </details>
            </TabsContent>

            {/* ─── macOS / Linux ─── */}
            <TabsContent value="linux" className="space-y-4">
              <div className="flex gap-2">
                <Button size="sm" disabled={!hasOrgId} onClick={() => downloadScript(linuxScript, 'topsqill-agent.sh')}>
                  <Download className="h-4 w-4 mr-2" />Download topsqill-agent.sh
                </Button>
              </div>

              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <h4 className="font-semibold text-sm">How to run on macOS (step-by-step)</h4>
                <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                  <li>Click <strong>"Download topsqill-agent.sh"</strong> above.</li>
                  <li>The file will save to your <strong>Downloads</strong> folder (don't open it in VS Code or a text editor).</li>
                  <li>Open <strong>Terminal</strong> — press <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs font-mono">⌘ Cmd</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs font-mono">Space</kbd>, type <strong>Terminal</strong>, press Enter.</li>
                  <li>Navigate to your Downloads folder:
                    <code className="block bg-muted rounded px-2 py-1 mt-1 font-mono text-xs">cd ~/Downloads</code>
                  </li>
                  <li>Make the script executable and run it:
                    <code className="block bg-muted rounded px-2 py-1 mt-1 font-mono text-xs">chmod +x topsqill-agent.sh && bash topsqill-agent.sh</code>
                  </li>
                  <li>You should see <strong>"Agent report completed successfully!"</strong> — then refresh this page.</li>
                </ol>
              </div>

              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <h4 className="font-semibold text-sm">How to run on Linux (step-by-step)</h4>
                <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                  <li>Click <strong>"Download topsqill-agent.sh"</strong> above.</li>
                  <li>Open a <strong>Terminal</strong>.</li>
                  <li>Navigate to your Downloads folder:
                    <code className="block bg-muted rounded px-2 py-1 mt-1 font-mono text-xs">cd ~/Downloads</code>
                  </li>
                  <li>Make the script executable and run it:
                    <code className="block bg-muted rounded px-2 py-1 mt-1 font-mono text-xs">chmod +x topsqill-agent.sh && sudo bash topsqill-agent.sh</code>
                  </li>
                  <li>You should see <strong>"Agent report completed successfully!"</strong> — then refresh this page.</li>
                </ol>
              </div>

              <details className="text-sm text-muted-foreground">
                <summary className="cursor-pointer font-medium">Advanced: Schedule with cron</summary>
                <p className="mt-2">Run every 6 hours automatically:</p>
                <code className="block bg-muted rounded px-2 py-1 mt-1 font-mono text-xs">0 */6 * * * /path/to/topsqill-agent.sh</code>
              </details>

              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground font-medium">View full script</summary>
                <div className="bg-muted rounded-lg p-3 mt-2 max-h-[250px] overflow-y-auto">
                  <pre className="font-mono whitespace-pre-wrap">{linuxScript}</pre>
                </div>
              </details>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Quick Test */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><CheckCircle className="h-5 w-5" />Quick Test (Copy & Paste)</CardTitle>
          <CardDescription>
            Don't want to download a file? Copy the command for your OS and paste it directly into your terminal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasOrgId ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              ⏳ Loading your organization profile… Please wait.
            </div>
          ) : (
            <Tabs defaultValue={defaultTab}>
              <TabsList>
                <TabsTrigger value="windows">Windows (PowerShell)</TabsTrigger>
                <TabsTrigger value="linux">macOS / Linux (Terminal)</TabsTrigger>
              </TabsList>

              {/* Windows Quick Test */}
              <TabsContent value="windows" className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <h4 className="font-semibold text-sm">Steps</h4>
                  <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                    <li>Open <strong>PowerShell as Administrator</strong> — right-click Start menu → "Windows PowerShell (Admin)".</li>
                    <li>Click <strong>"Copy Test Command"</strong> below.</li>
                    <li>Paste into PowerShell and press Enter.</li>
                    <li>You should see <code>{`{"success":true,...}`}</code> responses.</li>
                    <li>Come back here and click <strong>"Refresh"</strong> to see your device.</li>
                  </ol>
                </div>

                <div className="bg-muted rounded-lg p-3 max-h-[180px] overflow-y-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap">{windowsQuickTest}</pre>
                </div>

                <Button size="sm" onClick={() => { navigator.clipboard.writeText(windowsQuickTest); toast({ title: 'Copied!', description: 'Paste into PowerShell (Admin) and press Enter.' }); }}>
                  <Copy className="h-4 w-4 mr-2" />Copy Test Command
                </Button>
              </TabsContent>

              {/* macOS / Linux Quick Test */}
              <TabsContent value="linux" className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <h4 className="font-semibold text-sm">Steps</h4>
                  <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                    <li>Open <strong>Terminal</strong> (macOS: <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs font-mono">⌘ Cmd</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs font-mono">Space</kbd> → type "Terminal").</li>
                    <li>Click <strong>"Copy Test Command"</strong> below.</li>
                    <li>Paste into Terminal and press Enter.</li>
                    <li>You should see two <code>{`{"success":true,...}`}</code> responses.</li>
                    <li>Come back here and click <strong>"Refresh"</strong> to see your device.</li>
                  </ol>
                </div>

                <div className="bg-muted rounded-lg p-3 max-h-[180px] overflow-y-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap">{macLinuxQuickTest}</pre>
                </div>

                <Button size="sm" onClick={() => { navigator.clipboard.writeText(macLinuxQuickTest); toast({ title: 'Copied!', description: 'Paste into Terminal and press Enter.' }); }}>
                  <Copy className="h-4 w-4 mr-2" />Copy Test Command
                </Button>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Login Script Auto-Install */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><LogIn className="h-5 w-5" />Login Script (Auto-Install on Sign-In)</CardTitle>
          <CardDescription>
            Deploy this script via Group Policy (Windows) or Login Hook (macOS) / profile.d (Linux) so every user's device is automatically registered on first sign-in.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasOrgId ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              ⏳ Loading your organization profile… Please wait.
            </div>
          ) : (
            <Tabs defaultValue={defaultTab}>
              <TabsList>
                <TabsTrigger value="windows">Windows (GPO)</TabsTrigger>
                <TabsTrigger value="linux">macOS / Linux</TabsTrigger>
              </TabsList>

              <TabsContent value="windows" className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <h4 className="font-semibold text-sm">How to deploy via Group Policy</h4>
                  <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                    <li>Download the login script below and place it on a network share (e.g. <code className="font-mono text-xs bg-muted px-1 rounded">\\\\server\\scripts\\topsqill-login.ps1</code>).</li>
                    <li>Open <strong>Group Policy Management Console</strong> → edit a GPO linked to the target OU.</li>
                    <li>Navigate to <strong>User Configuration → Policies → Windows Settings → Scripts (Logon/Logoff)</strong>.</li>
                    <li>Click <strong>Logon → Add</strong> and browse to the network share path.</li>
                    <li>Devices will auto-register the next time a user signs in.</li>
                  </ol>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" disabled={!hasOrgId} onClick={() => downloadScript(windowsLoginScript, 'topsqill-login.ps1')}>
                    <Download className="h-4 w-4 mr-2" />Download topsqill-login.ps1
                  </Button>
                  <Button variant="outline" size="sm" disabled={!hasOrgId} onClick={() => copyScript(windowsLoginScript)}>
                    <Copy className="h-4 w-4 mr-2" />Copy Script
                  </Button>
                </div>

                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground font-medium">View login script</summary>
                  <div className="bg-muted rounded-lg p-3 mt-2 max-h-[200px] overflow-y-auto">
                    <pre className="font-mono whitespace-pre-wrap">{windowsLoginScript}</pre>
                  </div>
                </details>
              </TabsContent>

              <TabsContent value="linux" className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <h4 className="font-semibold text-sm">macOS: Login Hook</h4>
                  <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                    <li>Download the script and save to <code className="font-mono text-xs bg-muted px-1 rounded">/usr/local/bin/topsqill-login.sh</code>.</li>
                    <li>Make executable: <code className="font-mono text-xs bg-muted px-1 rounded">chmod +x /usr/local/bin/topsqill-login.sh</code></li>
                    <li>Set as login hook: <code className="font-mono text-xs bg-muted px-1 rounded">sudo defaults write com.apple.loginwindow LoginHook /usr/local/bin/topsqill-login.sh</code></li>
                  </ol>
                </div>

                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <h4 className="font-semibold text-sm">Linux: profile.d</h4>
                  <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                    <li>Download the script and save to <code className="font-mono text-xs bg-muted px-1 rounded">/etc/profile.d/topsqill-login.sh</code>.</li>
                    <li>Make executable: <code className="font-mono text-xs bg-muted px-1 rounded">chmod +x /etc/profile.d/topsqill-login.sh</code></li>
                    <li>The script runs automatically on each user's login shell.</li>
                  </ol>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" disabled={!hasOrgId} onClick={() => downloadScript(loginScriptUnix, 'topsqill-login.sh')}>
                    <Download className="h-4 w-4 mr-2" />Download topsqill-login.sh
                  </Button>
                  <Button variant="outline" size="sm" disabled={!hasOrgId} onClick={() => copyScript(loginScriptUnix)}>
                    <Copy className="h-4 w-4 mr-2" />Copy Script
                  </Button>
                </div>

                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground font-medium">View login script</summary>
                  <div className="bg-muted rounded-lg p-3 mt-2 max-h-[200px] overflow-y-auto">
                    <pre className="font-mono whitespace-pre-wrap">{loginScriptUnix}</pre>
                  </div>
                </details>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Self-Registering One-Liner */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Zap className="h-5 w-5" />Self-Registering Agent (One-Liner)</CardTitle>
          <CardDescription>
            A single command to paste into OS imaging, provisioning tools (e.g. Ansible, Terraform, cloud-init), or MDM bootstrap scripts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!hasOrgId ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              ⏳ Loading your organization profile… Please wait.
            </div>
          ) : (
            <Tabs defaultValue={defaultTab}>
              <TabsList>
                <TabsTrigger value="windows">Windows (PowerShell)</TabsTrigger>
                <TabsTrigger value="linux">macOS / Linux (bash)</TabsTrigger>
              </TabsList>

              <TabsContent value="windows" className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                  <h4 className="font-semibold text-sm">Use cases</h4>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Paste into a <strong>Windows MDT / WDS</strong> task sequence</li>
                    <li>Add to <strong>Intune</strong> as a PowerShell remediation script</li>
                    <li>Include in a <strong>Packer / Vagrant</strong> provisioner</li>
                  </ul>
                </div>
                <div className="bg-muted rounded-lg p-3 overflow-x-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap">{windowsOneLiner}</pre>
                </div>
                <Button size="sm" onClick={() => { navigator.clipboard.writeText(windowsOneLiner); toast({ title: 'Copied!', description: 'Paste into your provisioning workflow.' }); }}>
                  <Copy className="h-4 w-4 mr-2" />Copy One-Liner
                </Button>
              </TabsContent>

              <TabsContent value="linux" className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                  <h4 className="font-semibold text-sm">Use cases</h4>
                  <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                    <li>Add to <strong>cloud-init</strong> user-data / runcmd</li>
                    <li>Include in <strong>Ansible</strong> playbooks or <strong>Terraform</strong> provisioners</li>
                    <li>Paste into <strong>Jamf Pro</strong> enrollment scripts (macOS)</li>
                    <li>Add to <strong>Dockerfile</strong> or container build steps</li>
                  </ul>
                </div>
                <div className="bg-muted rounded-lg p-3 overflow-x-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap">{unixOneLiner}</pre>
                </div>
                <Button size="sm" onClick={() => { navigator.clipboard.writeText(unixOneLiner); toast({ title: 'Copied!', description: 'Paste into your provisioning workflow.' }); }}>
                  <Copy className="h-4 w-4 mr-2" />Copy One-Liner
                </Button>
              </TabsContent>
            </Tabs>
          )}
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
