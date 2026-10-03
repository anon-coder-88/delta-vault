"""Check the output of genuine GitHub Linguist; byte share, not files or lines."""
import json
import sys

languages = json.load(open(sys.argv[1], encoding="utf-8"))
sizes = {name: record["size"] for name, record in languages.items()}
total = sum(sizes.values())
solidity = sizes.get("Solidity", 0)
share = 100 * solidity / total if total else 0
print(json.dumps({"language_bytes": sizes, "total": total, "solidity_percent": share}, indent=2))
if total == 0 or solidity * 2 < total:
    raise SystemExit("Eligible Solidity bytes must account for at least 50%")
