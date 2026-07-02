import pandas as pd
import numpy as np
import os

# Cấu hình hạt giống ngẫu nhiên để dữ liệu của bạn chạy lần nào cũng đồng bộ
np.random.seed(42)

# Tự động lấy đường dẫn của thư mục chứa file code này
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Nối đường dẫn thư mục với tên file
ORIGINAL_FILE = os.path.join(BASE_DIR, "clean_telemetry.csv")
OUTPUT_FILE = os.path.join(BASE_DIR, "clean_telemetry_v2.csv")

if not os.path.exists(ORIGINAL_FILE):
    print(f"❌ LỖI: Không tìm thấy file '{ORIGINAL_FILE}' ở thư mục hiện tại!")
    print("Vui lòng đặt file này cùng cấp với file clean_telemetry.csv thô của nhóm nhé.")
else:
    print(f"🔄 Đang đọc dữ liệu gốc từ {ORIGINAL_FILE}...")
    df_orig = pd.read_csv(ORIGINAL_FILE)
    
    # Thiết lập cấu hình số lượng dòng theo yêu cầu: Tổng 2000 dòng, 400 dòng lỗi
    n_total = 2000
    n_fail = 400
    n_success = n_total - n_fail

    # 1. Trích xuất và nhân bản ngẫu nhiên 1600 dòng thành công (Completed)
    df_success_pool = df_orig[df_orig['flight_status'] == 'Completed']
    df_success = df_success_pool.sample(n=n_success, replace=True).copy()

    # 2. Tạo ra 400 dòng lỗi (Non-completed) dựa trên các quy luật vật lý/khí động học cực đoan
    df_fail = df_orig.sample(n=n_fail, replace=True).copy()

    for i in range(n_fail):
        # Đổi nhãn trạng thái chuyến bay sang dạng lỗi ngẫu nhiên
        fail_type = np.random.choice(['Aborted', 'Landed Unexpectedly'])
        df_fail.iloc[i, df_fail.columns.get_loc('flight_status')] = fail_type
        
        # Ép các biến số đầu vào rơi vào các tình huống bất định nguy hiểm
        cause = np.random.choice(['wind', 'overweight', 'battery', 'obstacles'])
        if cause == 'wind':
            # Gió giật cực đoan từ 7.5 m/s đến 12.5 m/s
            df_fail.iloc[i, df_fail.columns.get_loc('wind_speed')] = np.random.uniform(7.5, 12.5)
            df_fail.iloc[i, df_fail.columns.get_loc('obstacles_encountered')] = 'No'
        elif cause == 'overweight':
            # Cố tình chở hàng nặng vượt quá sức chở tối đa của thiết bị (Overweight)
            max_w = df_fail.iloc[i, df_fail.columns.get_loc('max_carry_weight')]
            df_fail.iloc[i, df_fail.columns.get_loc('actual_carry_weight')] = max_w * np.random.uniform(1.05, 1.3)
        elif cause == 'battery':
            # Pin tụt xuống mức nguy hiểm (15% - 35%) trong khi thời gian bay bị kéo dài
            df_fail.iloc[i, df_fail.columns.get_loc('battery_remaining')] = np.random.randint(15, 35)
            df_fail.iloc[i, df_fail.columns.get_loc('flight_duration')] = np.random.uniform(40.0, 65.0)
        else:
            # Gặp chướng ngại vật đô thị kèm sức gió lớn
            df_fail.iloc[i, df_fail.columns.get_loc('obstacles_encountered')] = 'Yes'
            df_fail.iloc[i, df_fail.columns.get_loc('wind_speed')] = np.random.uniform(6.0, 9.5)

    # 3. Gộp 2 tập dữ liệu thành công và thất bại lại với nhau
    df_combined = pd.concat([df_success, df_fail], ignore_index=True)

    # 4. Tính toán lại các cột đặc trưng phái sinh toán học để khớp chuẩn logic
    df_combined['overweight_flag'] = (df_combined['actual_carry_weight'] > df_combined['max_carry_weight']).astype(int)
    df_combined['weight_ratio'] = df_combined['actual_carry_weight'] / df_combined['max_carry_weight']
    
    # Tính lại điểm risk_score theo hàm tuyến tính đa biến kèm nhiễu ngẫu nhiên
    df_combined['risk_score'] = (
        0.5 + 
        df_combined['wind_speed'] * 0.12 + 
        df_combined['weight_ratio'] * 0.5 + 
        df_combined['distance_flown'] * 0.04 + 
        (100 - df_combined['battery_remaining']) * 0.01 + 
        (df_combined['obstacles_encountered'] == 'Yes').astype(int) * 0.3 +
        np.random.normal(0, 0.05, size=len(df_combined))
    )

    # Tạo lại mã định danh duy nhất (Unique IDs) cho đẹp mắt
    df_combined['drone_id'] = [f"D{i:04d}" for i in range(1, n_total + 1)]
    df_combined['operator_id'] = np.random.choice([f"OP{i:03d}" for i in range(1, 16)], size=n_total)
    df_combined['regulatory_approval_id'] = [f"REG-2026-UAV-{i:04d}" for i in range(1, n_total + 1)]

    # 5. Xuất thành file CSV vật lý trên máy của bạn
    df_combined.to_csv(OUTPUT_FILE, index=False)
    
    print("\n" + "="*50)
    print(f"✔ THÀNH CÔNG: Đã tạo file '{OUTPUT_FILE}' thành công!")
    print(f"📊 Tổng số dòng: {len(df_combined)}")
    print(df_combined['flight_status'].value_counts())
    print("="*50)