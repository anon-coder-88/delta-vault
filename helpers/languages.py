"""Measure authored source bytes; exclude dependencies, generated output and documentation."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
extensions = {'.sol': 'Solidity', '.ts': 'TypeScript', '.py': 'Python', '.html': 'HTML', '.css': 'CSS', '.js': 'JavaScript'}
excluded = {'node_modules', 'artifacts', 'cache', '.git', '.venv', '__pycache__'}
sizes = {}
production = {}
for path in root.rglob('*'):
    if path.is_file() and not excluded.intersection(path.relative_to(root).parts) and path.suffix in extensions:
        language = extensions[path.suffix]
        sizes[language] = sizes.get(language, 0) + path.stat().st_size
        if 'test' not in path.relative_to(root).parts:
            production[language] = production.get(language, 0) + path.stat().st_size
share = sizes.get('Solidity', 0) / sum(sizes.values()) * 100
production_share = production.get('Solidity', 0) / sum(production.values()) * 100
print(json.dumps({'source_bytes': sizes, 'solidity_percent': round(share, 2), 'production_source_bytes': production, 'production_solidity_percent': round(production_share, 2)}, indent=2))
if min(share, production_share) < 50:
    raise SystemExit('Solidity must account for at least 50% of authored source bytes')
