import yaml

d = yaml.safe_load(open('.github/workflows/apk.yml'))
wf = d.get('on') or d.get(True)
print('YAML parses: OK')
print('inputs:', list(wf['workflow_dispatch'].get('inputs', {}).keys()))
steps = d['jobs']['apk']['steps']
up = [s for s in steps if isinstance(s, dict) and s.get('uses', '').startswith('actions/upload-artifact')]
print('artifact path:', up[0]['with']['path'])
asm = [s for s in steps if isinstance(s, dict) and 'assemble' in str(s.get('run', ''))]
env = asm[0].get('env', {})
print('BUILD_TYPE env:', env.get('BUILD_TYPE'))
print('gradle line:', [l.strip() for l in asm[0]['run'].splitlines() if 'gradlew' in l])
