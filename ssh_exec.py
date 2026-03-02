import paramiko
import sys
import os

HOSTS = ['100.83.190.29', '89.167.94.105']
USER = 'root'
PASS = 'Ag4gciUujp7b'

def get_client():
    for host in HOSTS:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            client.connect(host, username=USER, password=PASS, timeout=5)
            print(f"Connected via {host}")
            return client
        except Exception:
            continue
    return None

def run_file(local_path):
    client = get_client()
    if not client:
        print("ERROR: Cannot connect")
        return
    with open(local_path, 'r') as f:
        content = f.read()
    ext = os.path.splitext(local_path)[1]
    if ext == '.py':
        remote_path = '/tmp/_remote_script.py'
        interpreter = 'python3'
    else:
        remote_path = '/tmp/_remote_script.sh'
        interpreter = 'bash'
    sftp = client.open_sftp()
    with sftp.file(remote_path, 'w') as rf:
        rf.write(content)
    sftp.close()
    stdin, stdout, stderr = client.exec_command(f'{interpreter} {remote_path}', timeout=300)
    print("STDOUT:", stdout.read().decode('utf-8', errors='replace'))
    err = stderr.read().decode('utf-8', errors='replace')
    if err:
        print("STDERR:", err)
    client.close()

def run_cmd(cmd):
    client = get_client()
    if not client:
        print("ERROR: Cannot connect")
        return
    stdin, stdout, stderr = client.exec_command(cmd, timeout=300)
    print("STDOUT:", stdout.read().decode('utf-8', errors='replace'))
    err = stderr.read().decode('utf-8', errors='replace')
    if err:
        print("STDERR:", err)
    client.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(1)
    if sys.argv[1] == '-c':
        run_cmd(' '.join(sys.argv[2:]))
    elif os.path.isfile(sys.argv[1]):
        run_file(sys.argv[1])
    else:
        run_cmd(sys.argv[1])
