"""NETSCAN: educational IP address and network information dashboard."""

import ipaddress
import os
import socket

from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# RFC 1918 IPv4 private ranges and the IPv6 unique-local range.
_PRIVATE_NETWORKS = (
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("fc00::/7"),
)


def classify_address(address):
    """Return a beginner-friendly version, class, and scope for an IP object."""
    version = f"IPv{address.version}"

    if address.version == 4:
        first_octet = int(str(address).split(".")[0])
        if 1 <= first_octet <= 126:
            address_class = "Class A"
        elif 128 <= first_octet <= 191:
            address_class = "Class B"
        elif 192 <= first_octet <= 223:
            address_class = "Class C"
        elif 224 <= first_octet <= 239:
            address_class = "Class D"
        elif 240 <= first_octet <= 255:
            address_class = "Class E"
        else:
            # 0/8 and 127/8 are reserved/special and outside the usual class table.
            address_class = "N/A"
    else:
        # A/B/C/D/E classes are a historical IPv4 concept, not used for IPv6.
        address_class = "N/A"

    if any(address in network for network in _PRIVATE_NETWORKS):
        address_type = "Private"
    elif address.is_global:
        address_type = "Public"
    else:
        address_type = "Special/Reserved"

    return {
        "ip": str(address),
        "version": version,
        "class": address_class,
        "type": address_type,
        "is_global": address.is_global,
        "is_private": address_type == "Private",
    }


def collect_server_network_info():
    """Collect details for the machine running Flask, never the browser visitor."""
    try:
        hostname = socket.gethostname()
    except OSError:
        hostname = "Unavailable"
    try:
        resolved_ip = socket.gethostbyname(hostname)
        ip_version = f"IPv{ipaddress.ip_address(resolved_ip).version}"
    except (OSError, ValueError):
        resolved_ip = "Unavailable"
        ip_version = "Unavailable"

    try:
        fqdn = socket.getfqdn()
    except OSError:
        fqdn = hostname

    hosted = __name__ != "__main__" or any(
        os.environ.get(name)
        for name in ("RENDER", "RAILWAY_ENVIRONMENT", "DYNO", "FLY_APP_NAME", "K_SERVICE")
    )
    return {
        "hostname": hostname,
        "fqdn": fqdn,
        "ip": resolved_ip,
        "version": ip_version,
        "runtime": "Hosted server" if hosted else "Local server",
        "scope_note": "These are server-side details, not the visitor's device details.",
    }


@app.get("/")
def index():
    """Serve the single-page dashboard."""
    return render_template("index.html")


@app.get("/api/network-info")
def network_info():
    """Return socket details for the Flask host with a clear scope label."""
    return jsonify(collect_server_network_info())


@app.post("/api/analyze-ip")
def analyze_ip():
    """Validate and classify an IPv4 or IPv6 address without network probing."""
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "Please send a JSON object containing an IP address."}), 400

    raw_ip = payload.get("ip")
    if not isinstance(raw_ip, str) or not raw_ip.strip():
        return jsonify({"error": "Please enter a valid IPv4 or IPv6 address."}), 400

    try:
        address = ipaddress.ip_address(raw_ip.strip())
    except ValueError:
        return jsonify({"error": "Please enter a valid IPv4 or IPv6 address."}), 400

    return jsonify(classify_address(address))


if __name__ == "__main__":
    # Render and other platforms provide PORT; local development defaults to 5000.
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=False)
