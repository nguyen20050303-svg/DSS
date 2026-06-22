import streamlit as st
import pandas as pd
import numpy as np
import joblib
import requests
import os
import json

# =====================================================================
# 1. CẤU HÌNH GIAO DIỆN WEB VÀ THÔNG SỐ NỀN
# =====================================================================
st.set_page_config(page_title="Drone Fleet Dispatching DSS", layout="wide", page_icon="🛸")

MODEL_PATH = "logistic_model.pkl"
DRONE_DB_PATH = "fact_drone_status.csv"
ORDER_DB_PATH = "fact_orders.csv"

WAREHOUSE_X = 10.8411
WAREHOUSE_Y = 106.8102
MIN_BATTERY_LEVEL = 30

# Tự động khởi tạo dữ liệu nền nếu thiếu file
if not os.path.exists(ORDER_DB_PATH) or not os.path.exists(DRONE_DB_PATH):
    orders_data = {
        "Order_ID": ["ORD-001", "ORD-002", "ORD-003"],
        "Customer_X": [10.8450, 10.8300, 10.8500],
        "Customer_Y": [106.8150, 106.8000, 106.8200],
        "Total_Weight_Gram": [2500.0, 4500.0, 1200.0]
    }
    pd.DataFrame(orders_data).to_csv(ORDER_DB_PATH, sep=';', index=False)

    drones_data = {
        "drone_id": ["D001", "D002", "D003", "D004", "D005"],
        "drone_model": ["FlyHigh 300", "Inspecta X", "CropMaster", "SwiftWing", "SkyPhantom"],
        "drone_size": ["Medium", "Large", "Large", "Medium", "Small"],
        "manufacturer": ["AeroCorp", "SkyView Inc.", "AgriDrones", "DeliveryNow", "AeroCorp"],
        "propeller_count": [4, 6, 8, 4, 4],
        "max_carry_weight": [5.0, 15.0, 20.0, 7.0, 2.0],
        "Battery_Level": [85, 28, 78, 92, 95],
        "Status": ["Ready", "Ready", "Busy", "Ready", "Ready"]
    }
    pd.DataFrame(drones_data).to_csv(DRONE_DB_PATH, sep=';', index=False)

# =====================================================================
# 2. PHÂN HỆ HÀM CHỨC NĂNG (BACKEND UTILS & LOADERS)
# =====================================================================
def load_orders():
    try:
        df = pd.read_csv(ORDER_DB_PATH, sep=';')
        if 'Order_ID' not in df.columns:
            df = pd.read_csv(ORDER_DB_PATH, sep=',')
    except Exception:
        df = pd.read_csv(ORDER_DB_PATH)
    # Đảm bảo cột Order_ID ở dạng string
    df['Order_ID'] = df['Order_ID'].astype(str)
    return df

def load_drones():
    try:
        df_status = pd.read_csv(DRONE_DB_PATH, sep=';')
        if 'Drone_ID' not in df_status.columns and 'drone_id' not in df_status.columns:
            df_status = pd.read_csv(DRONE_DB_PATH, sep=',')
    except Exception:
        df_status = pd.read_csv(DRONE_DB_PATH)
        
    # Merge status với specifications trong clean_telemetry.csv nếu có
    if os.path.exists("clean_telemetry.csv"):
        df_telemetry = pd.read_csv("clean_telemetry.csv")
        df_specs = df_telemetry[['drone_id', 'drone_model', 'drone_size', 'manufacturer', 'propeller_count', 'max_carry_weight']].drop_duplicates(subset=['drone_id'])
        
        status_id_col = 'Drone_ID' if 'Drone_ID' in df_status.columns else 'drone_id'
        df_status['drone_id_mapped'] = df_status[status_id_col].apply(lambda x: f"D{int(x)+1:03d}" if str(x).isdigit() else str(x))
        df_drones = pd.merge(df_status, df_specs, left_on='drone_id_mapped', right_on='drone_id', how='left')
        if 'drone_id_x' in df_drones.columns:
            df_drones['drone_id'] = df_drones['drone_id_x']
        
        # Điền giá trị mặc định an toàn cho các dòng bị khuyết cấu hình
        df_drones['drone_model'] = df_drones['drone_model'].fillna("FlyHigh 300")
        df_drones['drone_size'] = df_drones['drone_size'].fillna("Medium")
        df_drones['manufacturer'] = df_drones['manufacturer'].fillna("AeroCorp")
        df_drones['propeller_count'] = df_drones['propeller_count'].fillna(4).astype(int)
        df_drones['max_carry_weight'] = df_drones['max_carry_weight'].fillna(5.0)
    else:
        df_drones = df_status
        
    return df_drones

def update_drone_status(drone_id, new_status):
    try:
        try:
            df = pd.read_csv(DRONE_DB_PATH, sep=';')
            sep = ';'
            if 'Drone_ID' not in df.columns and 'drone_id' not in df.columns:
                df = pd.read_csv(DRONE_DB_PATH, sep=',')
                sep = ','
        except Exception:
            df = pd.read_csv(DRONE_DB_PATH)
            sep = ','
            
        status_id_col = 'Drone_ID' if 'Drone_ID' in df.columns else 'drone_id'
        df[status_id_col] = df[status_id_col].astype(str)
        df.loc[df[status_id_col] == str(drone_id), 'Status'] = new_status
        df.to_csv(DRONE_DB_PATH, sep=sep, index=False)
        return True
    except Exception as e:
        st.error(f"Lỗi khi cập nhật trạng thái drone: {e}")
        return False

def reset_all_drones():
    try:
        try:
            df = pd.read_csv(DRONE_DB_PATH, sep=';')
            sep = ';'
            if 'Drone_ID' not in df.columns and 'drone_id' not in df.columns:
                df = pd.read_csv(DRONE_DB_PATH, sep=',')
                sep = ','
        except Exception:
            df = pd.read_csv(DRONE_DB_PATH)
            sep = ','
            
        df['Status'] = 'Ready'
        df.to_csv(DRONE_DB_PATH, sep=sep, index=False)
        return True
    except Exception as e:
        st.error(f"Lỗi khi reset đội bay: {e}")
        return False

def fetch_live_wind(lat=WAREHOUSE_X, lng=WAREHOUSE_Y):
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=wind_speed_10m"
    try:
        response = requests.get(url, timeout=3)
        data = response.json()
        return round(float(data['current']['wind_speed_10m']) / 3.6, 2), True # km/h -> m/s, is_live=True
    except:
        return 3.5, False # Gió dự phòng, is_live=False

def compute_km(x1, y1, x2, y2):
    raw_dist = abs(x1 - x2) + abs(y1 - y2)
    # Tự động nhận diện Kinh vĩ độ (< 1.0) hoặc tọa độ Grid (> 1.0)
    if raw_dist < 1.0:
        return round(raw_dist * 111.0, 2)
    else:
        # Quy đổi grid sang km (1 đơn vị grid = 30m = 0.03 km) để khớp với tầm bay 3-28km trong tập telemetry
        return round(raw_dist * 0.03, 2)

# =====================================================================
# 3. THIẾT KẾ ĐIỀU HƯỚNG GIAO DIỆN WEB APP (SIDEBAR MENU)
# =====================================================================
st.sidebar.title("🛸 Hệ Thống UAV DSS")
st.sidebar.markdown("---")
app_mode = st.sidebar.selectbox("Lựa chọn màn hình tác nghiệp:", ["1. Khách Hàng Đặt Đơn", "2. Trung Tâm Điều Phối Đội Bay"])

# =====================================================================
# MÀN HÌNH 1: PHÂN HỆ KHÁCH HÀNG ĐẶT ĐƠN
# =====================================================================
if app_mode == "1. Khách Hàng Đặt Đơn":
    st.title("🛒 Cổng Thông Tin Đặt Hàng Chặng Cuối (Customer Portal)")
    st.markdown("Khách hàng nhập bưu kiện và vị trí để lưu thông tin vào cơ sở dữ liệu logistics.")
    
    with st.form("order_form", clear_on_submit=True):
        col1, col2 = st.columns(2)
        with col1:
            weight_g = st.number_input("Trọng lượng bưu kiện (Gram):", min_value=100, max_value=25000, value=1500, step=100)
            st.caption("Ví dụ: 1500 Gram = 1.5 kg")
        with col2:
            st.markdown("**Vị trí giao hàng dự kiến:**")
            cust_x = st.number_input("Tọa độ X / Vĩ độ (Latitude):", min_value=0.0, max_value=1000.0, value=340.0, format="%.4f")
            cust_y = st.number_input("Tọa độ Y / Kinh độ (Longitude):", min_value=0.0, max_value=1000.0, value=371.0, format="%.4f")
            
        submit_btn = st.form_submit_button("Xác Nhận Đặt Hàng")
        
        if submit_btn:
            df_orders = load_orders()
            new_id = f"ORD-{len(df_orders) + 1:03d}"
            new_row = pd.DataFrame([{
                "Order_ID": new_id,
                "Customer_X": cust_x,
                "Customer_Y": cust_y,
                "Total_Weight_Gram": float(weight_g)
            }])
            df_orders = pd.concat([df_orders, new_row], ignore_index=True)
            df_orders.to_csv(ORDER_DB_PATH, sep=';', index=False)
            st.success(f"🎉 Đặt hàng thành công! Mã đơn hàng của bạn là: **{new_id}** (Đã lưu database).")

# =====================================================================
# MÀN HÌNH 2: TRUNG TÂM ĐIỀU PHỐI ĐỘI BAY (DISPATCHER)
# =====================================================================
else:
    col_title, col_reset = st.columns([3, 1])
    with col_title:
        st.title("🎛️ Màn Hình Kiểm Soát Không Lưu & Điều Phối (Dispatcher Control Tower)")
    with col_reset:
        st.markdown("<div style='height: 15px;'></div>", unsafe_allow_html=True)
        if st.button("🔄 Cho Tất Cả Drone Rảnh Lại", use_container_width=True, help="Đặt lại trạng thái Ready cho toàn bộ đội bay"):
            if reset_all_drones():
                st.success("Đã đặt lại trạng thái Ready cho toàn bộ đội bay!")
                st.rerun()
                
    st.markdown("Hỗ trợ người điều phối quét rủi ro thời gian thực bằng Trí tuệ nhân tạo trước khi duyệt cất cánh.")
    
    # Hiển thị thông báo giao hàng thành công từ session state (nếu có)
    if "dispatch_success" in st.session_state:
        uav_id, order_id = st.session_state["dispatch_success"]
        st.balloons()
        st.success(f"✈ Đã gửi lệnh điều khiển bay thời gian thực cho Drone **{uav_id}** thực thi nhiệm vụ giao đơn hàng **{order_id}** thành công! Trạng thái của Drone đã chuyển sang Busy.")
        del st.session_state["dispatch_success"]
    
    # Đọc thông tin từ database tệp phẳng bằng hàm load có xử lý phân tách
    df_orders = load_orders()
    df_drones = load_drones()
    
    # Hiển thị Khối KPI Thượng tầng
    kpi1, kpi2, kpi3 = st.columns(3)
    with kpi1:
        st.metric("Tổng đơn chờ điều phối", f"{len(df_orders)} Đơn hàng", delta="Hàng đợi động")
    with kpi2:
        ready_count = len(df_drones[df_drones['Status'] == 'Ready'])
        st.metric("Tỷ lệ sẵn sàng đội bay", f"{(ready_count/len(df_drones))*100:.1f}%", f"{ready_count} Drone Rảnh")
    with kpi3:
        # Lấy gió thật từ API ngay khi mở trang điều phối
        live_wind, is_live = fetch_live_wind()
        if is_live:
            st.metric("Tốc độ gió real-time (API)", f"{live_wind} m/s", "Open-Meteo API", delta_color="inverse")
        else:
            st.metric("Tốc độ gió (Dự phòng)", f"{live_wind} m/s", "KHÔNG LẤY ĐƯỢC API", delta="Cảnh báo", delta_color="off")

    # Hiển thị cảnh báo nếu không gọi được API
    if not is_live:
        st.warning("⚠ CẢNH BÁO: Hệ thống không thể kết nối tới API thời tiết Open-Meteo. Đang tự động áp dụng tốc độ gió dự phòng là **3.5 m/s** để thực hiện phân tích rủi ro.")

    st.markdown("---")
    
    # Chia giao diện làm 2 phân khu Tả - Hữu theo bản thiết kế Wireframe
    left_col, right_col = st.columns([2, 3])
    
    with left_col:
        st.subheader("📋 Hàng đợi đơn hàng chờ xử lý")
        st.dataframe(df_orders, use_container_width=True, hide_index=True)
        
        # Dispatcher chọn một mã đơn hàng bất kỳ để tiến hành phân tích
        selected_order_id = st.selectbox("Chọn mã đơn hàng cần kiểm tra:", df_orders['Order_ID'].tolist())
        
        # Reset trạng thái phân tích nếu đổi đơn hàng
        if "active_analysis" in st.session_state and st.session_state["active_analysis"] != selected_order_id:
            del st.session_state["active_analysis"]
            
        analyze_clicked = st.button("🚀 KÍCH HOẠT PHÂN TÍCH RỦI RO ĐỘNG", type="primary", use_container_width=True)
        if analyze_clicked:
            st.session_state["active_analysis"] = selected_order_id

    with right_col:
        st.subheader("🤖 Khuyến nghị phương án an toàn từ AI")
        
        # Dùng session_state để kiểm tra thay vì biến analyze_clicked trực tiếp
        if "active_analysis" in st.session_state:
            current_analysis_order = st.session_state["active_analysis"]
            if not os.path.exists(MODEL_PATH):
                st.error(f"Không tìm thấy file bộ não AI tại {MODEL_PATH}. Vui lòng train lại mô hình!")
            else:
                # Tiến hành bóc tách bối cảnh đơn hàng được chọn
                order_row = df_orders[df_orders['Order_ID'] == current_analysis_order]
                weight_kg = float(order_row['Total_Weight_Gram'].values[0]) / 1000.0
                
                cust_x_val = float(order_row['Customer_X'].values[0])
                cust_y_val = float(order_row['Customer_Y'].values[0])
                
                # Xác định tọa độ Kho dựa trên tọa độ khách hàng (Kinh vĩ độ hay Grid)
                if cust_x_val < 90.0:  # Kinh vĩ độ
                    wh_x, wh_y = WAREHOUSE_X, WAREHOUSE_Y
                else:  # Grid (ví dụ 340)
                    try:
                        wh_x = float(df_drones['Current_X'].iloc[0])
                        wh_y = float(df_drones['Current_Y'].iloc[0])
                    except Exception:
                        wh_x, wh_y = 113.0, 179.0
                
                dist_km = compute_km(wh_x, wh_y, cust_x_val, cust_y_val)
                
                st.info(f"📊 **Bối cảnh phân tích:** Đơn nặng **{weight_kg:.2f} kg** | Quãng đường: **{dist_km:.2f} km** | Gió API: **{live_wind} m/s**")
                
                # Thực hiện Vòng lặp duyệt đội bay và áp dụng bộ lọc cứng Heuristics
                valid_drones = df_drones[
                    (df_drones['Status'] == 'Ready') & 
                    (df_drones['Battery_Level'] >= MIN_BATTERY_LEVEL) & 
                    (df_drones['max_carry_weight'] >= weight_kg)
                ].copy()
                
                if valid_drones.empty:
                    st.error("❌ CẢNH BÁO LOGISTICS: Không có chiếc drone nào trong kho đáp ứng được tiêu chuẩn lọc cứng phần cứng hoặc đủ lượng pin!")
                else:
                    # Đóng gói dữ liệu và gọi tệp pkl chấm điểm
                    pipeline_model = joblib.load(MODEL_PATH)
                    approved_list = []
                    
                    for _, drone in valid_drones.iterrows():
                        w_ratio = weight_kg / float(drone['max_carry_weight'])
                        ow_flag = 1 if w_ratio > 1.0 else 0
                        sim_risk = (live_wind * 0.12) + (w_ratio * 0.4) + (dist_km * 0.05)
                        
                        # Tạo cấu trúc DataFrame tương thích 100% không gian đặc trưng huấn luyện
                        X_live = pd.DataFrame([{
                            'application': 'Package Delivery', 'drone_size': drone['drone_size'],
                            'drone_model': drone['drone_model'], 'manufacturer': drone['manufacturer'],
                            'propeller_count': int(drone['propeller_count']), 'max_carry_weight': float(drone['max_carry_weight']),
                            'actual_carry_weight': weight_kg, 'payload_type': 'Package', 'payload_description': 'Consumer goods',
                            'altitude': 60, 'distance_flown': dist_km, 'gps_accuracy': 2.1, 'wind_speed': live_wind,
                            'overweight_flag': ow_flag, 'weight_ratio': w_ratio, 'risk_score': sim_risk,
                            'flight_duration': 30.0, 'battery_remaining': float(drone['Battery_Level']) - 10.0,
                            'obstacles_encountered': 'No', 'notes': np.nan
                        }])
                        
                        # AI đưa ra dự báo
                        ai_label = pipeline_model.predict(X_live)[0]
                        
                        if ai_label == "Completed":
                            # Lấy ID gốc của drone (có thể là dạng chuỗi Dxxx hoặc số nguyên)
                            drone_id_disp = drone['Drone_ID'] if 'Drone_ID' in drone else drone['drone_id']
                            approved_list.append({
                                "Drone_ID": drone_id_disp,
                                "Model": drone['drone_model'],
                                "Pin_Hiện_Tại": f"{drone['Battery_Level']}%",
                                "Sức_Tải_Max": f"{drone['max_carry_weight']} kg",
                                "Trạng_Thái_AI": "Completed 🟢 (An Toàn)"
                            })
                    
                    # Xuất danh sách xếp hạng Top Drone ra màn hình giao diện
                    if not approved_list:
                        st.error("🔴 CẢNH BÁO KHÔNG LƯU CỰC ĐOAN: Bộ não AI dự báo tất cả các phương án cất cánh đều gặp nguy hiểm dưới sức gió hiện tại! Khuyến nghị chuyển sang xe tải mặt đất.")
                    else:
                        st.success("✔ Tìm thấy danh sách các thiết bị đủ điều kiện an toàn bay dưới bối cảnh nhiễu động hiện tại:")
                        df_res = pd.DataFrame(approved_list).sort_values(by="Pin_Hiện_Tại", ascending=False)
                        
                        # Hiển thị bảng Top lựa chọn khuyến nghị
                        st.dataframe(df_res.head(3), use_container_width=True, hide_index=True)
                        
                        # Chức năng ra quyết định cuối cùng của con người (Dispatcher Action)
                        selected_uav = st.selectbox("🎯 Chọn chiếc drone bạn muốn phê duyệt phát lệnh cất cánh:", df_res['Drone_ID'].tolist())
                        if st.button("PHÁT LỆNH CẤT CÁNH (CONFIRM DISPATCH)", type="secondary"):
                            if update_drone_status(selected_uav, "Busy"):
                                st.session_state["dispatch_success"] = (selected_uav, current_analysis_order)
                                # Reset trạng thái phân tích sau khi đã giao hàng thành công
                                if "active_analysis" in st.session_state:
                                    del st.session_state["active_analysis"]
                                st.rerun()
        else:
            st.warning("👈 Vui lòng nhấn chọn một đơn hàng bên trái và click vào nút phân tích để kích hoạt mô hình AI.")