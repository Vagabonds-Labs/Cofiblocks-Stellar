# {
#     "sw1": {"total": 3, "passed": 2, "failed": 1},
#     "sw2": {"total": 1, "passed": 0, "failed": 1},
# }

def summarize_results(results):
    response = {}
    for result in results:
        response.setdefault(result["device"], {"total": 0, "passed": 0, "failed": 0})
        response[result["device"]]["total"] += 1
        response[result["device"]][result["status"]] += 1
    return response

results = [
    {"device": "sw1", "status": "passed"},
    {"device": "sw2", "status": "failed"},
    {"device": "sw1", "status": "failed"},
    {"device": "sw1", "status": "passed"},
]

summary = summarize_results(results)
print(summary)