#!/usr/bin/env python3
import base64
import importlib.util
import json
import pathlib
import sys


ROOT = pathlib.Path(__file__).resolve().parents[2]
UPSTREAM_MODULE = ROOT / "vendor" / "upstream" / "xmltodict.py"


def load_reference_module():
    if not UPSTREAM_MODULE.exists():
        raise FileNotFoundError(
            f"Reference module not found at {UPSTREAM_MODULE}. Run `npm run sync:upstream` first."
        )

    spec = importlib.util.spec_from_file_location("xmltodict_upstream", UPSTREAM_MODULE)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load Python reference module from {UPSTREAM_MODULE}")

    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def decode_value(value):
    if isinstance(value, list):
        return [decode_value(item) for item in value]
    if isinstance(value, dict):
        kind = value.get("__type")
        if kind == "bytes":
          return base64.b64decode(value["base64"])
        if kind == "generator":
          items = [decode_value(item) for item in value["items"]]
          return (item for item in items)
        return {key: decode_value(item) for key, item in value.items()}
    return value


def encode_value(value):
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if isinstance(value, bytes):
        return {
            "__type": "bytes",
            "base64": base64.b64encode(value).decode("ascii"),
        }
    if isinstance(value, list):
        return [encode_value(item) for item in value]
    if isinstance(value, tuple):
        return [encode_value(item) for item in value]
    if isinstance(value, dict):
        return {str(key): encode_value(item) for key, item in value.items()}
    return str(value)


def run_command(payload):
    ref = load_reference_module()
    operation = payload["op"]

    if operation == "parse":
        xml_input = decode_value(payload["xml_input"])
        kwargs = decode_value(payload.get("kwargs", {}))
        return ref.parse(xml_input, **kwargs)

    if operation == "unparse":
        input_dict = decode_value(payload["input_dict"])
        kwargs = decode_value(payload.get("kwargs", {}))
        return ref.unparse(input_dict, **kwargs)

    if operation == "smoke":
        return {
            "module": "xmltodict",
            "reference": str(UPSTREAM_MODULE),
            "available": True,
        }

    raise ValueError(f"Unsupported operation: {operation}")


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "smoke":
        print(json.dumps(encode_value(run_command({"op": "smoke"})), ensure_ascii=False))
        return

    payload = json.load(sys.stdin)
    try:
        result = run_command(payload)
        response = {"ok": True, "result": encode_value(result)}
    except Exception as exc:
        response = {
            "ok": False,
            "error": {
                "type": exc.__class__.__name__,
                "message": str(exc),
            },
        }
    print(json.dumps(response, ensure_ascii=False))


if __name__ == "__main__":
    main()

