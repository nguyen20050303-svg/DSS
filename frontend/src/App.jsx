import { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('dispatch'); // 'orders' or 'dispatch'
  
  // Data State
  const [orders, setOrders] = useState([]);
  const [drones, setDrones] = useState([]);
  const [liveWind, setLiveWind] = useState(3.5);
  const [weatherCode, setWeatherCode] = useState(0);
  const [precipitation, setPrecipitation] = useState(0.0);
  const [isLiveWind, setIsLiveWind] = useState(false);
  
  // Interactive UI State
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [riskResults, setRiskResults] = useState(null);
  const [selectedDroneId, setSelectedDroneId] = useState('');
  const [dispatchSuccess, setDispatchSuccess] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [notification, setNotification] = useState('');

  // Loading States
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingDrones, setLoadingDrones] = useState(false);
  
  // Form State (New Order)
  const [formWeight, setFormWeight] = useState(1500);
  const [formCustX, setFormCustX] = useState(340.0);
  const [formCustY, setFormCustY] = useState(371.0);

  // Fetch Orders Queue
  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
        if (data.length > 0 && !selectedOrderId) {
          setSelectedOrderId(data[0].Order_ID);
        }
      }
    } catch (err) {
      console.error("Lỗi khi fetch orders:", err);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Fetch Drones Fleet
  const fetchDrones = async () => {
    setLoadingDrones(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/drones`);
      if (res.ok) {
        const data = await res.json();
        setDrones(data);
      }
    } catch (err) {
      console.error("Lỗi khi fetch drones:", err);
    } finally {
      setLoadingDrones(false);
    }
  };

  // Fetch Live Weather Wind
  const fetchWind = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/weather/wind`);
      if (res.ok) {
        const data = await res.json();
        setLiveWind(data.wind_speed);
        setWeatherCode(data.weather_code || 0);
        setPrecipitation(data.precipitation || 0.0);
        setIsLiveWind(data.is_live);
      }
    } catch (err) {
      console.error("Lỗi khi fetch wind:", err);
    }
  };

  // Run on Mount & Active Tab updates
  useEffect(() => {
    fetchOrders();
    fetchDrones();
    fetchWind();
  }, [activeTab]);

  // Handle Order Submit
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setNotification('');
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Customer_X: parseFloat(formCustX),
          Customer_Y: parseFloat(formCustY),
          Total_Weight_Gram: parseFloat(formWeight)
        })
      });
      
      if (res.ok) {
        const newOrder = await res.json();
        setNotification(`🎉 Đặt hàng thành công! Mã đơn hàng của bạn là: ${newOrder.Order_ID} (Đã lưu database).`);
        // Reset form to defaults
        setFormWeight(1500);
        setFormCustX(340.0);
        setFormCustY(371.0);
        fetchOrders();
      } else {
        setErrorMsg('Lỗi khi gửi yêu cầu đặt hàng lên server.');
      }
    } catch (err) {
      setErrorMsg('Không thể kết nối đến máy chủ backend.');
      console.error(err);
    }
  };

  // Handle Drones Reset
  const handleResetDrones = async () => {
    setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/drones/reset`, { method: 'POST' });
      if (res.ok) {
        setNotification('Đã đặt lại trạng thái Ready cho toàn bộ đội bay!');
        fetchDrones();
        setRiskResults(null);
      } else {
        setErrorMsg('Lỗi khi reset trạng thái drones.');
      }
    } catch (err) {
      setErrorMsg('Không thể kết nối đến máy chủ backend.');
    }
  };

  // Handle AI Risk Analysis
  const handleAnalyzeRisk = async () => {
    if (!selectedOrderId) {
      setErrorMsg('Vui lòng chọn một đơn hàng để phân tích.');
      return;
    }
    
    setAnalyzing(true);
    setErrorMsg('');
    setRiskResults(null);
    setDispatchSuccess(null);
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/analyze-risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: selectedOrderId })
      });
      
      if (res.ok) {
        const data = await res.json();
        setRiskResults(data);
        if (data.length > 0) {
          setSelectedDroneId(data[0].Drone_ID);
        }
      } else {
        const errorData = await res.json();
        setErrorMsg(errorData.detail || 'Lỗi khi kích hoạt mô hình phân tích AI.');
      }
    } catch (err) {
      setErrorMsg('Không thể kết nối đến máy chủ backend.');
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  // Handle Confirm Dispatch
  const handleDispatch = async () => {
    if (!selectedDroneId || !selectedOrderId) return;
    setErrorMsg('');
    setNotification('');
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/drones/${selectedDroneId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Busy' })
      });
      
      if (res.ok) {
        setDispatchSuccess({ drone: selectedDroneId, order: selectedOrderId });
        setRiskResults(null);
        fetchDrones();
        fetchOrders();
      } else {
        setErrorMsg('Lỗi khi gửi lệnh điều phối bay.');
      }
    } catch (err) {
      setErrorMsg('Không thể kết nối đến máy chủ backend.');
    }
  };

  // Calculated Metrics
  const readyCount = drones.filter(d => d.Status === 'Ready').length;
  const readinessRate = drones.length > 0 ? ((readyCount / drones.length) * 100).toFixed(1) : '0.0';

  // Helper: WMO weather description
  const getWeatherDescription = (code) => {
    if (code === 0) return "Trời quang";
    if ([1, 2, 3].includes(code)) return "Nhiều mây / U ám";
    if ([45, 48].includes(code)) return "Có sương mù";
    if ([51, 53, 55, 56, 57].includes(code)) return "Mưa phùn nhẹ";
    if ([61, 63].includes(code)) return "Mưa vừa";
    if (code === 65) return "Mưa to dữ dội";
    if (code === 67) return "Mưa băng giá nặng";
    if ([71, 73].includes(code)) return "Tuyết rơi vừa";
    if (code === 75) return "Tuyết rơi rất dày";
    if (code === 77) return "Mưa hạt tuyết";
    if ([80, 81].includes(code)) return "Mưa rào nhẹ";
    if (code === 82) return "Mưa rào xối xả";
    if (code === 85) return "Mưa tuyết nhẹ";
    if (code === 86) return "Mưa tuyết rất nặng";
    if (code === 95) return "Giông bão nhẹ/vừa";
    if ([96, 99].includes(code)) return "Giông bão kèm mưa đá cực mạnh";
    return "Không xác định";
  };

  // Weather triggers check: heavy rain (>=65), storm (>=95), precipitation > 5.0mm, or wind > 10.0m/s
  const dangerousWmoCodes = [65, 67, 75, 82, 86, 95, 96, 99];
  const isExtremeWeather = dangerousWmoCodes.includes(weatherCode) || precipitation > 5.0 || liveWind > 10.0;

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <nav className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">🛸</span>
          <span className="sidebar-title">UAV DSS System</span>
        </div>
        
        <ul className="menu-list">
          <li 
            className={`menu-item ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            🛒 Khách Hàng Đặt Đơn
          </li>
          <li 
            className={`menu-item ${activeTab === 'dispatch' ? 'active' : ''}`}
            onClick={() => setActiveTab('dispatch')}
          >
            🎛️ Trung Tâm Điều Phối
          </li>
        </ul>
      </nav>

      {/* Main Panel Content */}
      <main className="main-content">
        
        {/* Global Notifications/Alerts */}
        {notification && (
          <div className="alert alert-success success-banner">
            <div>{notification}</div>
            <button style={{background:'none', border:'none', color:'inherit', cursor:'pointer', float:'right'}} onClick={() => setNotification('')}>✕</button>
          </div>
        )}
        {errorMsg && (
          <div className="alert alert-danger">
            <div>⚠ CẢNH BÁO: {errorMsg}</div>
          </div>
        )}

        {/* ======================================= */}
        {/* SCREEN 1: ORDER PLACEMENT (CUSTOMER)     */}
        {/* ======================================= */}
        {activeTab === 'orders' && (
          <div>
            <h1>🛒 Cổng Thông Tin Đặt Hàng Chặng Cuối</h1>
            <p className="subtitle">Khách hàng nhập bưu kiện và vị trí để lưu thông tin vào cơ sở dữ liệu logistics Supabase.</p>
            
            <div className="card-panel" style={{maxWidth: '650px', margin: '0 auto'}}>
              <h2 className="card-title">📝 Đăng ký đơn hàng mới</h2>
              <form onSubmit={handlePlaceOrder}>
                <div className="form-group">
                  <label>Trọng lượng bưu kiện (Gram):</label>
                  <input 
                    type="number" 
                    min="100" 
                    max="25000" 
                    value={formWeight}
                    onChange={(e) => setFormWeight(e.target.value)}
                    required
                  />
                  <div className="form-hint">Ví dụ: 1500 Gram = 1.5 kg (Tải trọng giới hạn 0.1kg - 25kg)</div>
                </div>

                <div className="row">
                  <div className="col form-group">
                    <label>Tọa độ X / Vĩ độ (Latitude):</label>
                    <input 
                      type="number" 
                      step="0.0001"
                      min="0.0"
                      max="1000.0"
                      value={formCustX}
                      onChange={(e) => setFormCustX(e.target.value)}
                      required
                    />
                  </div>
                  <div className="col form-group">
                    <label>Tọa độ Y / Kinh độ (Longitude):</label>
                    <input 
                      type="number" 
                      step="0.0001"
                      min="0.0"
                      max="1000.0"
                      value={formCustY}
                      onChange={(e) => setFormCustY(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{marginTop: '1rem'}}>
                  Xác Nhận Đặt Hàng
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* SCREEN 2: DISPATCH CONTROL TOWER         */}
        {/* ======================================= */}
        {activeTab === 'dispatch' && (
          <div>
            <div className="header-actions">
              <div>
                <h1>🎛️ Màn Hình Kiểm Soát Không Lưu & Điều Phối</h1>
                <p className="subtitle" style={{marginBottom: 0}}>Hỗ trợ người điều phối quét rủi ro thời gian thực bằng Trí tuệ nhân tạo (scikit-learn Pipeline) trước khi duyệt cất cánh.</p>
              </div>
              <button 
                onClick={handleResetDrones} 
                className="btn btn-secondary" 
                style={{width: 'auto'}}
                title="Đặt lại trạng thái Ready cho toàn bộ đội bay"
              >
                🔄 Cho Tất Cả Drone Rảnh Lại
              </button>
            </div>

            {/* Top KPI Metrics Dashboard */}
            <div className="kpi-container">
              <div className="kpi-card">
                <div className="kpi-title">Đơn chờ điều phối</div>
                <div className="kpi-value">{loadingOrders ? '...' : `${orders.length} Đơn hàng`}</div>
                <div className="kpi-detail">Hàng đợi động (Supabase DB)</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Sẵn sàng đội bay</div>
                <div className="kpi-value">{loadingDrones ? '...' : `${readinessRate}%`}</div>
                <div className="kpi-detail">{readyCount} chiếc rảnh trên tổng số {drones.length}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-title">Thời tiết & Gió</div>
                <div className="kpi-value" style={{ fontSize: '1.6rem', marginTop: '0.2rem' }}>
                  {liveWind} m/s | {getWeatherDescription(weatherCode)}
                </div>
                <div className="kpi-detail">
                  {precipitation > 0 ? `Lượng mưa: ${precipitation} mm | ` : ''}
                  {isLiveWind ? 'Open-Meteo API (Live)' : 'Dự phòng'}
                </div>
              </div>
            </div>

            {/* Dispatcher Actions Feedback */}
            {dispatchSuccess && (
              <div className="alert alert-success success-banner" style={{marginBottom: '2rem'}}>
                <div>
                  ✈ <strong>Đã duyệt bay!</strong> Đã gửi lệnh điều khiển bay thời gian thực cho Drone <strong>{dispatchSuccess.drone}</strong> thực thi nhiệm vụ giao đơn hàng <strong>{dispatchSuccess.order}</strong> thành công! Trạng thái của Drone đã chuyển sang <strong>Busy</strong>.
                </div>
              </div>
            )}

            {!isLiveWind && (
              <div className="alert alert-warning" style={{marginBottom: '2rem'}}>
                ⚠ CẢNH BÁO: Hệ thống không thể kết nối tới API thời tiết Open-Meteo. Đang tự động áp dụng tốc độ gió dự phòng là <strong>3.5 m/s</strong> để thực hiện phân tích rủi ro động.
              </div>
            )}

            {isExtremeWeather && (
              <div className="alert alert-danger success-banner" style={{ background: '#7f1d1d', border: '2px solid #ef4444', color: '#fca5a5', padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 0 15px rgba(239,68,68,0.5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '2.5rem' }}>🚨</span>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>THỜI TIẾT CỰC ĐOAN - NGHIÊM CẤM CẤT CÁNH</h3>
                    <p>Hệ thống ghi nhận thời tiết nguy hiểm: <strong>Gió {liveWind} m/s</strong>, <strong>Lượng mưa: {precipitation} mm</strong>, hiện trạng: <strong>{getWeatherDescription(weatherCode)}</strong>. Lệnh cất cánh tự động bị khóa để đảm bảo an toàn.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Split Panels: Queue & AI Recommendations */}
            <div className="grid-2col">
              
              {/* Left Column: Queue List */}
              <div className="card-panel">
                <h3 className="card-title">📋 Hàng đợi đơn hàng chờ xử lý</h3>
                
                <div className="table-wrapper">
                  {loadingOrders ? (
                    <div style={{padding: '2rem', display: 'flex', justifyContent: 'center'}}><div className="spinner"></div></div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Mã Đơn</th>
                          <th>Toạ độ X</th>
                          <th>Toạ độ Y</th>
                          <th>Trọng lượng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.length === 0 ? (
                          <tr>
                            <td colSpan="4" style={{textAlign: 'center', color: 'var(--text-muted)'}}>Không có đơn hàng nào trong hàng đợi.</td>
                          </tr>
                        ) : (
                          orders.map((o) => (
                            <tr key={o.Order_ID}>
                              <td><strong>{o.Order_ID}</strong></td>
                              <td>{o.Customer_X}</td>
                              <td>{o.Customer_Y}</td>
                              <td>{(o.Total_Weight_Gram / 1000).toFixed(2)} kg</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="form-group" style={{marginTop: '1.5rem'}}>
                  <label>Chọn mã đơn hàng cần kiểm tra:</label>
                  <select 
                    value={selectedOrderId} 
                    onChange={(e) => {
                      setSelectedOrderId(e.target.value);
                      setRiskResults(null);
                    }}
                    disabled={orders.length === 0}
                  >
                    {orders.length === 0 && <option value="">(Không có đơn hàng)</option>}
                    {orders.map(o => (
                      <option key={o.Order_ID} value={o.Order_ID}>{o.Order_ID} ({(o.Total_Weight_Gram/1000).toFixed(2)} kg)</option>
                    ))}
                  </select>
                </div>

                <button 
                  onClick={handleAnalyzeRisk} 
                  className="btn btn-primary"
                  disabled={analyzing || orders.length === 0}
                >
                  {analyzing ? (
                    <>
                      <div className="spinner" style={{marginRight: '0.5rem'}}></div> Đang phân tích rủi ro...
                    </>
                  ) : '🚀 KÍCH HOẠT PHÂN TÍCH RỦI RO ĐỘNG'}
                </button>
              </div>

              {/* Right Column: AI Recommendations */}
              <div className="card-panel">
                <h3 className="card-title">🤖 Khuyến nghị phương án an toàn từ AI</h3>

                {riskResults === null ? (
                  <div className="alert alert-info" style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0, padding: '3rem 2rem', textAlign: 'center'}}>
                    <div>
                      <p style={{fontSize: '1.5rem', marginBottom: '0.5rem'}}>👈</p>
                      Vui lòng chọn một đơn hàng bên trái và click vào nút phân tích để kích hoạt mô hình AI.
                    </div>
                  </div>
                ) : riskResults.length === 0 ? (
                  <div className="alert alert-danger" style={{margin: 0}}>
                    <h4>🔴 CẢNH BÁO KHÔNG LƯU CỰC ĐOAN:</h4>
                    <p style={{marginTop: '0.5rem'}}>Bộ não AI dự báo tất cả các phương án cất cánh đều gặp nguy hiểm dưới sức gió hiện tại! Khuyến nghị chuyển sang vận tải mặt đất.</p>
                  </div>
                ) : (
                  <div>
                    <div className="alert alert-success" style={{marginBottom: '1.5rem'}}>
                      ✔ Tìm thấy danh sách các thiết bị đủ điều kiện an toàn bay dưới bối cảnh nhiễu động hiện tại:
                    </div>

                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Drone ID</th>
                            <th>Mẫu Thiết Bị</th>
                            <th>Dung lượng Pin</th>
                            <th>Sức Tải tối đa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {riskResults.map((rec) => (
                            <tr key={rec.Drone_ID}>
                              <td><strong>{rec.Drone_ID}</strong></td>
                              <td>{rec.Model}</td>
                              <td>{rec.Pin_Hien_Tai}</td>
                              <td>{rec.Suc_Tai_Max}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="form-group" style={{marginTop: '1.5rem'}}>
                      <label>🎯 Chọn chiếc drone phê duyệt phát lệnh cất cánh:</label>
                      <select 
                        value={selectedDroneId} 
                        onChange={(e) => setSelectedDroneId(e.target.value)}
                      >
                        {riskResults.map(rec => (
                          <option key={rec.Drone_ID} value={rec.Drone_ID}>
                            {rec.Drone_ID} - {rec.Model} (Pin: {rec.Pin_Hien_Tai})
                          </option>
                        ))}
                      </select>
                    </div>

                    <button 
                      onClick={handleDispatch}
                      className="btn btn-primary"
                      style={isExtremeWeather ? {
                        background: '#374151',
                        color: '#9ca3af',
                        cursor: 'not-allowed',
                        border: '1px solid rgba(255,255,255,0.05)',
                        boxShadow: 'none'
                      } : {
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        boxShadow: '0 4px 15px rgba(16, 185, 129, 0.2)'
                      }}
                      disabled={isExtremeWeather}
                    >
                      {isExtremeWeather ? '🔒 ĐÃ KHÓA CẤT CÁNH (DO THỜI TIẾT XẤU)' : 'PHÁT LỆNH CẤT CÁNH (CONFIRM DISPATCH)'}
                    </button>
                  </div>
                )}
              </div>

            </div>

            {/* Bottom Row: Drone Fleet List */}
            <div className="card-panel" style={{marginTop: '2.5rem'}}>
              <h3 className="card-title">🛸 Danh sách toàn bộ đội thiết bị bay (UAV Fleet)</h3>
              
              <div className="table-wrapper" style={{maxHeight: '600px'}}>
                {loadingDrones ? (
                  <div style={{padding: '2rem', display: 'flex', justifyContent: 'center'}}><div className="spinner"></div></div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Drone ID</th>
                        <th>Model</th>
                        <th>Kích Cỡ</th>
                        <th>Hãng Sản Xuất</th>
                        <th>Số Cánh Quạt</th>
                        <th>Tải Trọng Max</th>
                        <th>Dung Lượng Pin</th>
                        <th>Tọa Độ Hiện Tại</th>
                        <th>Trạng Thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drones.map((d) => {
                        const isBatteryLow = d.Battery_Level < 30;
                        const batteryColor = d.Battery_Level >= 70 ? 'var(--color-success)' : isBatteryLow ? 'var(--color-danger)' : 'var(--color-warning)';
                        
                        return (
                          <tr key={d.Drone_ID}>
                            <td><strong>{d.Drone_ID}</strong></td>
                            <td>{d.drone_model}</td>
                            <td>{d.drone_size}</td>
                            <td>{d.manufacturer}</td>
                            <td>{d.propeller_count} cánh</td>
                            <td>{d.max_carry_weight} kg</td>
                            <td>
                              <div className="battery-container">
                                <div className="battery-bar-outer">
                                  <div 
                                    className="battery-bar-inner" 
                                    style={{
                                      width: `${d.Battery_Level}%`,
                                      backgroundColor: batteryColor
                                    }}
                                  ></div>
                                </div>
                                <span className="battery-text" style={{color: batteryColor}}>{d.Battery_Level}%</span>
                              </div>
                            </td>
                            <td>X: {d.Current_X} | Y: {d.Current_Y}</td>
                            <td>
                              <span className={`badge ${d.Status === 'Ready' ? 'badge-ready' : 'badge-busy'}`}>
                                {d.Status === 'Ready' ? 'Ready 🟢' : 'Busy 🔴'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}

export default App;
