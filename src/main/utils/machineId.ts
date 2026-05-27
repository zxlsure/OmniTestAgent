import { execSync } from 'child_process'

export function getMachineId(): string {
  try {
    if (process.platform === 'win32') {
      return execSync('wmic csproduct get UUID', { encoding: 'utf-8' }).split('\n')[1].trim()
    } else if (process.platform === 'darwin') {
      return execSync('ioreg -rd1 -c IOPlatformExpertDevice | awk \'/IOPlatformUUID/ { gsub(/"/, "", $3); print $3 }\'', { encoding: 'utf-8' }).trim()
    } else {
      return execSync('cat /etc/machine-id', { encoding: 'utf-8' }).trim()
    }
  } catch {
    return 'default-machine-id'
  }
}
