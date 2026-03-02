import json

env_path = '/root/peds/.env'

with open(env_path, 'r') as f:
    lines = f.readlines()

replacements = {
    'NEXTAUTH_URL=': 'NEXTAUTH_URL="https://peds.89-167-94-105.nip.io"\n',
}

new_lines = []
for line in lines:
    replaced = False
    for key, value in replacements.items():
        if line.strip().startswith(key) and not line.strip().startswith('#'):
            new_lines.append(value)
            print(f"FIXED: {line.strip()} -> {value.strip()}")
            replaced = True
            break
    if not replaced:
        new_lines.append(line)

with open(env_path, 'w') as f:
    f.writelines(new_lines)

print("Done!")
