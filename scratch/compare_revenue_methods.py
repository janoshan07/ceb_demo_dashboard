import mysql.connector
import json

conn = mysql.connector.connect(
    host="localhost",
    user="root",
    password="Ceb@2516",
    database="ceb_billing_db"
)
cursor = conn.cursor(dictionary=True)

cursor.execute("SELECT id, division, billing_month, total_records, final_data_json FROM monthly_directory_snapshot WHERE status='APPROVED'")
snapshots = cursor.fetchall()

# Method A: Grouped by snapshot.billing_month
method_a = {}
# Method B: Grouped by record['billingMonth']
method_b = {}
# Method C: Old Dashboard method (salesAmount first, grouped by parseYearMonth)
old_dash = {}

for s in snapshots:
    snap_month = s['billing_month'] or 'Unknown'
    data = json.loads(s['final_data_json']) if s['final_data_json'] else []
    for r in data:
        # PaymentControl currentPayment logic:
        # energyPurchase -> salesAmount -> kwhSalesAmount -> totalAmount
        ep = r.get('energyPurchase')
        sa = r.get('salesAmount')
        ta = r.get('totalAmount')
        
        curr_payment = None
        for k in ['energyPurchase', 'salesAmount', 'kwhSalesAmount', 'totalAmount']:
            v = r.get(k)
            if v is not None:
                try:
                    curr_payment = float(v)
                    break
                except:
                    pass
        if curr_payment is None:
            curr_payment = 0.0

        # Old dash logic: salesAmount -> energyPurchase -> totalAmount -> paymentSettled
        old_rev = None
        for k in ['salesAmount', 'energyPurchase', 'totalAmount', 'paymentSettled', 'payment']:
            v = r.get(k)
            if v is not None:
                try:
                    old_rev = float(v)
                    break
                except:
                    pass
        if old_rev is None:
            old_rev = 0.0

        # Method A: by snapshot billing_month
        method_a[snap_month] = method_a.get(snap_month, 0.0) + curr_payment

        # Method B: by record billingMonth
        rec_month = r.get('billingMonth') or r.get('billingPeriod') or snap_month
        method_b[rec_month] = method_b.get(rec_month, 0.0) + curr_payment

        # Old dash by snap_month
        old_dash[snap_month] = old_dash.get(snap_month, 0.0) + old_rev

print("=== METHOD A (snapshot.billing_month with canonical currentPayment) ===")
for m, val in method_a.items():
    print(f"  {m}: LKR {val:,.2f}")

print("\n=== METHOD B (record.billingMonth with canonical currentPayment) ===")
for m, val in method_b.items():
    print(f"  {m}: LKR {val:,.2f}")

print("\n=== OLD DASHBOARD METHOD (salesAmount first) ===")
for m, val in old_dash.items():
    print(f"  {m}: LKR {val:,.2f}")

cursor.close()
conn.close()

