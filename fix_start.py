import json

with open('/root/peds/package.json', 'r') as f:
    pkg = json.load(f)

pkg['scripts']['start'] = 'next start -H 127.0.0.1 -p 3005'

with open('/root/peds/package.json', 'w') as f:
    json.dump(pkg, f, indent=2, ensure_ascii=False)
    f.write('\n')

print('OK: start script updated to:', pkg['scripts']['start'])
