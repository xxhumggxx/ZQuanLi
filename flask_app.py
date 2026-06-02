"""
TRÀ CHANH ZODY - Flask Backend
Python Anywhere: đặt file này là flask_app.py (hoặc app.py)
Cấu hình WSGI trỏ vào biến `app`
"""

import os
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from supabase import create_client, Client
from datetime import date, datetime
from functools import wraps
import hashlib

# ── Khởi tạo ──────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "zody-secret-2024-change-me")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://lhtgdqgjpyxnvkmtskme.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxodGdkcWdqcHl4bnZrbXRza21lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDcyNjcsImV4cCI6MjA5NTg4MzI2N30.pbcLjcO5tu8D1n5T8UY63qHpG-A2p6_QIyu8o627NT4")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "201710999"

# ── Helper ─────────────────────────────────────────────────
def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("is_admin"):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated

def shift_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("shift_id"):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated

# ── Pages ──────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/admin-panel")
def admin_panel():
    if not session.get("is_admin"):
        return redirect(url_for("admin_login_page"))
    return render_template("admin.html")

@app.route("/admin-login")
def admin_login_page():
    return render_template("admin_login.html")

# ── Auth API ───────────────────────────────────────────────
@app.route("/api/login/shift", methods=["POST"])
def login_shift():
    data = request.json
    password = data.get("password", "").strip()
    today = str(date.today())

    res = supabase.table("shifts").select("*").eq("password", password).eq("is_active", True).execute()
    if not res.data:
        return jsonify({"error": "Sai mật khẩu ca"}), 401

    shift = res.data[0]
    session["shift_id"]   = shift["id"]
    session["shift_name"] = shift["name"]
    session["is_admin"]   = False

    # Tìm hoặc tạo report cho ca hôm nay
    rpt = supabase.table("shift_reports")\
        .select("*")\
        .eq("shift_id", shift["id"])\
        .eq("report_date", today)\
        .execute()

    if rpt.data:
        report_id = rpt.data[0]["id"]
        is_new = False
    else:
        # Tạo report mới
        new_rpt = supabase.table("shift_reports").insert({
            "shift_id": shift["id"],
            "shift_name": shift["name"],
            "report_date": today
        }).execute()
        report_id = new_rpt.data[0]["id"]
        is_new = True

        # Lấy nguyên liệu cuối ca trước (gần nhất) để làm đầu ca mới
        _seed_opening_inventory(report_id, shift["id"], today)

    session["report_id"] = report_id
    return jsonify({"ok": True, "shift_name": shift["name"], "report_id": report_id, "is_new": is_new})

def _seed_opening_inventory(new_report_id, shift_id, today):
    """Copy closing_qty của ca trước thành opening_qty của ca này."""
    # Lấy report gần nhất trước hôm nay (bất kỳ ca nào)
    prev = supabase.table("shift_reports")\
        .select("id")\
        .lt("report_date", today)\
        .eq("status","submitted")\
        .order("report_date", desc=True)\
        .order("submitted_at", desc=True)\
        .limit(1).execute()

    if not prev.data:
        # Không có ca trước: dùng default_value = 0
        mats = supabase.table("materials").select("*").eq("is_active", True).execute()
        rows = [{
            "report_id": new_report_id,
            "material_id": m["id"],
            "material_name": m["name"],
            "opening_qty": m["default_value"],
            "closing_qty": m["default_value"],
            "unit": m["unit"]
        } for m in mats.data]
    else:
        prev_id = prev.data[0]["id"]
        prev_entries = supabase.table("inventory_entries")\
            .select("*").eq("report_id", prev_id).execute()
        rows = [{
            "report_id": new_report_id,
            "material_id": e["material_id"],
            "material_name": e["material_name"],
            "opening_qty": e["closing_qty"],
            "closing_qty": e["closing_qty"],
            "unit": e["unit"]
        } for e in prev_entries.data]

        # Thêm nguyên liệu mới chưa có
        existing_ids = {r["material_id"] for r in rows}
        mats = supabase.table("materials").select("*").eq("is_active", True).execute()
        for m in mats.data:
            if m["id"] not in existing_ids:
                rows.append({
                    "report_id": new_report_id,
                    "material_id": m["id"],
                    "material_name": m["name"],
                    "opening_qty": m["default_value"],
                    "closing_qty": m["default_value"],
                    "unit": m["unit"]
                })

    if rows:
        supabase.table("inventory_entries").insert(rows).execute()

@app.route("/api/login/admin", methods=["POST"])
def login_admin():
    data = request.json
    if data.get("username") == ADMIN_USERNAME and data.get("password") == ADMIN_PASSWORD:
        session["is_admin"] = True
        session["shift_id"] = None
        return jsonify({"ok": True})
    return jsonify({"error": "Sai tài khoản hoặc mật khẩu"}), 401

@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})

# ── Inventory API ──────────────────────────────────────────
@app.route("/api/inventory", methods=["GET"])
@shift_required
def get_inventory():
    report_id = session["report_id"]
    entries = supabase.table("inventory_entries")\
        .select("*, materials(category, sort_order)")\
        .eq("report_id", report_id).execute()
    return jsonify(entries.data)

@app.route("/api/inventory/<entry_id>", methods=["PATCH"])
@shift_required
def update_inventory(entry_id):
    data = request.json
    res = supabase.table("inventory_entries")\
        .update({"closing_qty": data["closing_qty"], "note": data.get("note","") })\
        .eq("id", entry_id).execute()
    return jsonify(res.data)

# ── Finance API ────────────────────────────────────────────
@app.route("/api/finance", methods=["GET"])
@shift_required
def get_finance():
    report_id = session["report_id"]
    fin = supabase.table("shift_finance")\
        .select("*").eq("report_id", report_id).execute()
    # Lấy tổng chi
    exp = supabase.table("expenses")\
        .select("amount").eq("report_id", report_id).execute()
    total_exp = sum(e["amount"] for e in exp.data)
    return jsonify({"finance": fin.data[0] if fin.data else None, "total_expense": total_exp})

@app.route("/api/finance", methods=["POST"])
@shift_required
def save_finance():
    data = request.json
    report_id = session["report_id"]

    # Tính tổng chi từ bảng expenses
    exp = supabase.table("expenses")\
        .select("amount").eq("report_id", report_id).execute()
    total_exp = sum(e["amount"] for e in exp.data)

    payload = {
        "report_id": report_id,
        "opening_cash": data.get("opening_cash", 0),
        "software_revenue": data.get("software_revenue", 0),
        "bank_transfer": data.get("bank_transfer", 0),
        "total_expense": total_exp,
        "register_keep": data.get("register_keep", 500000),
        "pig_keep": data.get("pig_keep", 30000),
    }

    existing = supabase.table("shift_finance")\
        .select("id").eq("report_id", report_id).execute()
    if existing.data:
        res = supabase.table("shift_finance")\
            .update(payload).eq("report_id", report_id).execute()
    else:
        res = supabase.table("shift_finance").insert(payload).execute()

    return jsonify(res.data)

# ── Expenses API ───────────────────────────────────────────
@app.route("/api/expenses", methods=["GET"])
@shift_required
def get_expenses():
    report_id = session["report_id"]
    res = supabase.table("expenses")\
        .select("*").eq("report_id", report_id)\
        .order("created_at").execute()
    return jsonify(res.data)

@app.route("/api/expenses", methods=["POST"])
@shift_required
def add_expense():
    data = request.json
    report_id = session["report_id"]
    res = supabase.table("expenses").insert({
        "report_id": report_id,
        "description": data["description"],
        "amount": data["amount"]
    }).execute()
    return jsonify(res.data)

@app.route("/api/expenses/<exp_id>", methods=["DELETE"])
@shift_required
def delete_expense(exp_id):
    supabase.table("expenses").delete().eq("id", exp_id).execute()
    return jsonify({"ok": True})

# ── Submit report ──────────────────────────────────────────
@app.route("/api/report/submit", methods=["POST"])
@shift_required
def submit_report():
    report_id = session["report_id"]
    supabase.table("shift_reports").update({
        "status": "submitted",
        "submitted_at": datetime.utcnow().isoformat()
    }).eq("id", report_id).execute()
    return jsonify({"ok": True})

# ── ADMIN APIs ─────────────────────────────────────────────
@app.route("/api/admin/shifts", methods=["GET"])
@admin_required
def admin_get_shifts():
    res = supabase.table("shifts").select("*").order("created_at").execute()
    return jsonify(res.data)

@app.route("/api/admin/shifts", methods=["POST"])
@admin_required
def admin_create_shift():
    data = request.json
    res = supabase.table("shifts").insert({
        "name": data["name"],
        "password": data["password"],
        "shift_type": data.get("shift_type","morning")
    }).execute()
    return jsonify(res.data)

@app.route("/api/admin/shifts/<sid>", methods=["PATCH"])
@admin_required
def admin_update_shift(sid):
    data = request.json
    res = supabase.table("shifts").update(data).eq("id", sid).execute()
    return jsonify(res.data)

@app.route("/api/admin/shifts/<sid>", methods=["DELETE"])
@admin_required
def admin_delete_shift(sid):
    supabase.table("shifts").update({"is_active": False}).eq("id", sid).execute()
    return jsonify({"ok": True})

@app.route("/api/admin/materials", methods=["GET"])
@admin_required
def admin_get_materials():
    res = supabase.table("materials").select("*")\
        .eq("is_active", True)\
        .order("category").order("sort_order").execute()
    return jsonify(res.data)

@app.route("/api/admin/materials", methods=["POST"])
@admin_required
def admin_add_material():
    data = request.json
    res = supabase.table("materials").insert({
        "category": data["category"],
        "name": data["name"],
        "unit": data["unit"],
        "default_value": data.get("default_value", 0),
        "sort_order": data.get("sort_order", 99)
    }).execute()
    return jsonify(res.data)

@app.route("/api/admin/materials/<mid>", methods=["PATCH"])
@admin_required
def admin_update_material(mid):
    data = request.json
    res = supabase.table("materials").update(data).eq("id", mid).execute()
    return jsonify(res.data)

@app.route("/api/admin/materials/<mid>", methods=["DELETE"])
@admin_required
def admin_delete_material(mid):
    supabase.table("materials").update({"is_active": False}).eq("id", mid).execute()
    return jsonify({"ok": True})

@app.route("/api/admin/reports", methods=["GET"])
@admin_required
def admin_get_reports():
    date_from = request.args.get("from", str(date.today()))
    date_to   = request.args.get("to",   str(date.today()))
    res = supabase.table("shift_reports")\
        .select("*, shift_finance(*), inventory_entries(*), expenses(*)")\
        .gte("report_date", date_from)\
        .lte("report_date", date_to)\
        .order("report_date", desc=True)\
        .order("submitted_at", desc=True)\
        .execute()
    return jsonify(res.data)

@app.route("/api/admin/consumption", methods=["GET"])
@admin_required
def admin_consumption():
    """Hao hụt nguyên liệu theo khoảng thời gian"""
    date_from = request.args.get("from", str(date.today()))
    date_to   = request.args.get("to",   str(date.today()))
    reports = supabase.table("shift_reports")\
        .select("id, shift_name, report_date")\
        .gte("report_date", date_from)\
        .lte("report_date", date_to)\
        .eq("status","submitted").execute()

    report_ids = [r["id"] for r in reports.data]
    if not report_ids:
        return jsonify([])

    entries = supabase.table("inventory_entries")\
        .select("*")\
        .in_("report_id", report_ids).execute()

    # Group by material
    consumption = {}
    for e in entries.data:
        mn = e["material_name"]
        if mn not in consumption:
            consumption[mn] = {"material_name": mn, "unit": e["unit"], "total_consumed": 0, "details": []}
        consumed = (e["opening_qty"] or 0) - (e["closing_qty"] or 0)
        consumption[mn]["total_consumed"] += consumed

    return jsonify(list(consumption.values()))

@app.route("/api/admin/stats/daily", methods=["GET"])
@admin_required
def admin_daily_stats():
    """Thống kê doanh thu theo ngày"""
    date_from = request.args.get("from", str(date.today()))
    date_to   = request.args.get("to",   str(date.today()))
    reports = supabase.table("shift_reports")\
        .select("report_date, shift_name, shift_finance(*)")\
        .gte("report_date", date_from)\
        .lte("report_date", date_to)\
        .order("report_date").execute()
    return jsonify(reports.data)

# ── Run ────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, port=5000)