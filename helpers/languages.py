"""Report source bytes honestly, including the complete website and TSX files."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
extensions = {'.sol': 'Solidity', '.ts': 'TypeScript', '.tsx': 'TypeScript', '.py': 'Python', '.html': 'HTML', '.css': 'CSS', '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript'}
excluded = {'node_modules', 'artifacts', 'cache', '.git', '.venv', '__pycache__', 'dist', '.next', '.wrangler', '.sites-runtime'}
sizes, production = {}, {}
for path in root.rglob('*'):
    parts = path.relative_to(root).parts
    if not path.is_file() or excluded.intersection(parts) or path.suffix not in extensions:
        continue
    language = extensions[path.suffix]
    sizes[language] = sizes.get(language, 0) + path.stat().st_size
    if not {'test', 'tests'}.intersection(parts):
        production[language] = production.get(language, 0) + path.stat().st_size

def percent(values):
    return round(values.get('Solidity', 0) / sum(values.values()) * 100, 2) if values else 0

report = {'source_bytes': sizes, 'solidity_percent': percent(sizes), 'production_source_bytes': production,
          'production_solidity_percent': percent(production), 'target_percent': 50,
          'target_met': min(percent(sizes), percent(production)) >= 50,
          'method': 'Source bytes; complete website included, dependencies and generated output excluded; no language overrides.'}
print(json.dumps(report, indent=2))
# Reporting does not silently discard website code or fabricate contracts to pass a threshold.
