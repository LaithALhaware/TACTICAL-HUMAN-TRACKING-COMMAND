from flask import Flask, render_template, request, redirect, session, jsonify, send_file
from flask_cors import CORS
from auth import login_required
import time, json, os, random
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet


import requests
import asyncio
import websockets
import socket
import netifaces
import psutil
from scapy.all import ARP, Ether, srp

from mac_vendor_lookup import MacLookup
import platform
import nmap


app = Flask(__name__)
app.secret_key = "super_secret_key"
CORS(app)

ROOMS = {
    "room1": {"size": 6},
    "room2": {"size": 8}
}

history = {}



# ================= LOGIN ================= https://github.com/ruvnet/RuView
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        if request.form["username"] == "admin" and request.form["password"] == "admin123":
            session["user"] = "admin"
            return redirect("/")
    return render_template("login.html")

@app.route("/logout")
def logout():
    session.clear()
    return redirect("/login")

# ================= DASHBOARD =================
@app.route("/")
@login_required
def home():
    return render_template("index.html", rooms=ROOMS.keys())


@app.route('/proxy/vital-signs')
def proxy_vital_signs():
    r = requests.get('http://localhost:3000/api/v1/vital-signs')
    return jsonify(r.json())


# ================= TRACKING DATA =================
@app.route("/tracking_data/<room>")
@login_required
def tracking(room):
    if room not in ROOMS:
        return jsonify({"error": "Invalid room"})

    if room not in history:
        history[room] = []

    size = ROOMS[room]["size"]

    try:
        # Fetch latest sensing data
        resp = requests.get("http://localhost:3000/api/v1/sensing/latest", timeout=2)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return jsonify({"error": f"Failed to fetch sensing data: {str(e)}"})

    # Extract people positions from nodes
    people = []
    for node in data.get("nodes", []):
        pos = node.get("position", [0, 0, 0])
        x = round(pos[0], 2)
        z = round(pos[2], 2)
        # Clamp to room size
        x = min(max(x, 0), size)
        z = min(max(z, 0), size)
        people.append([x, z])

    # Extract signal features
    features = data.get("features", {})
    signal_features = {
        "variance": features.get("variance"),
        "motion_band_power": features.get("motion_band_power"),
        "breathing_band_power": features.get("breathing_band_power"),
        "spectral_power": features.get("spectral_power"),
        "dominant_freq_hz": features.get("dominant_freq_hz"),
        "change_points": features.get("change_points"),
        "mean_rssi": features.get("mean_rssi")
    }

    # Extract vital signs
    vital_signs = data.get("vital_signs", {})

    # Timestamp
    timestamp = time.strftime("%H:%M:%S")

    # Append to room history
    history[room].append({
        "time": timestamp,
        "people": people,
        "signal_features": signal_features,
        "vital_signs": vital_signs
    })

    # Keep only last 100 entries
    if len(history[room]) > 100:
        history[room] = history[room][-100:]

    return jsonify(history[room])



# -----------------------------
# Get Router (Gateway) IP
# -----------------------------
def get_router_ip():
    gateways = netifaces.gateways()
    return gateways['default'][netifaces.AF_INET][0]


# -----------------------------
# Get Public IP
# -----------------------------
def get_public_ip():
    try:
        return requests.get("https://api.ipify.org").text
    except:
        return "Unavailable"


# -----------------------------
# Scan Local Network Devices
# -----------------------------
def scan_network(ip_range):
    arp = ARP(pdst=ip_range)
    ether = Ether(dst="ff:ff:ff:ff:ff:ff")
    packet = ether/arp
    result = srp(packet, timeout=2, verbose=0)[0]

    devices = []
    lookup = MacLookup()

    for sent, received in result:
        try:
            vendor = lookup.lookup(received.hwsrc)
        except:
            vendor = "Unknown"

        devices.append({
            "ip": received.psrc,
            "mac": received.hwsrc,
            "vendor": vendor
        })

    return devices


# -----------------------------
# Get Open Ports (Basic Scan)
# -----------------------------
def scan_ports(ip):
    nm = nmap.PortScanner()
    nm.scan(ip, "22-443")
    ports = []

    for proto in nm[ip].all_protocols():
        lport = nm[ip][proto].keys()
        for port in lport:
            ports.append(port)

    return ports


# -----------------------------
# Main INFO Route
# -----------------------------
@app.route("/info")
def info():

    router_ip = get_router_ip()
    local_ip = socket.gethostbyname(socket.gethostname())
    hostname = socket.gethostname()

    network_range = router_ip.rsplit('.', 1)[0] + ".0/24"

    devices = scan_network(network_range)

    # Scan router ports (optional)
    try:
        router_ports = scan_ports(router_ip)
    except:
        router_ports = []

    data = {
        "system": {
            "hostname": hostname,
            "local_ip": local_ip,
            "public_ip": get_public_ip(),
            "os": platform.system(),
            "os_version": platform.version(),
            "cpu_usage_percent": psutil.cpu_percent(),
            "ram_usage_percent": psutil.virtual_memory().percent
        },
        "network": {
            "router_ip": router_ip,
            "network_range": network_range,
            "interfaces": psutil.net_if_addrs()
        },
        "router": {
            "open_ports": router_ports
        },
        "connected_devices": devices,
        "total_devices": len(devices)
    }

    return jsonify(data)


# ================= SAVE =================
@app.route("/save/<room>")
@login_required
def save(room):
    with open("recording.json", "w") as f:
        json.dump(history.get(room, []), f)
    return jsonify({"status": "saved"})

# ================= PDF EXPORT =================
@app.route("/export_pdf/<room>")
@login_required
def export_pdf(room):
    filename = f"{room}_report.pdf"
    doc = SimpleDocTemplate(filename)
    elements = []
    styles = getSampleStyleSheet()

    elements.append(Paragraph(f"Tracking Report - {room}", styles["Heading1"]))
    elements.append(Spacer(1, 20))

    for entry in history.get(room, []):
        elements.append(Paragraph(
            f"{entry['time']} - Positions: {entry['people']}",
            styles["Normal"]
        ))

    doc.build(elements)
    return send_file(filename, as_attachment=True)

if __name__ == "__main__":
    app.run(debug=True)
