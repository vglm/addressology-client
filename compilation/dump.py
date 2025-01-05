import json

with open("Contract.sol") as r:
    code = r.read()
    print(json.dumps(code))
