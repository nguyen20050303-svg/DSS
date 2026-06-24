import requests

API_URL = "http://localhost:8000/api/orders"

def test_api():
    print("Fetching orders...")
    res = requests.get(API_URL)
    if res.status_code == 200:
        orders = res.json()
        print(f"Fetched {len(orders)} orders.")
        if orders:
            print("First order sample:")
            print(orders[0])
        else:
            print("No orders. Let's create one...")
            payload = {
                "Customer_X": 10.70,
                "Customer_Y": 106.73,
                "Total_Weight_Gram": 2000,
                "customer_address": "Nguyen Van Linh, District 7"
            }
            res_post = requests.post(API_URL, json=payload)
            if res_post.status_code == 200:
                print("Created order successfully:")
                print(res_post.json())
                # fetch again
                res2 = requests.get(API_URL)
                print("Fetched again:")
                print(res2.json())
            else:
                print(f"Create order failed: {res_post.status_code} - {res_post.text}")
    else:
        print(f"Fetch failed: {res.status_code} - {res.text}")

if __name__ == "__main__":
    test_api()
