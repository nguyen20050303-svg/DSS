import { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('dispatch'); // 'orders', 'dispatch', or 'config'
  
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
  const [formCustX, setFormCustX] = useState('');
  const [formCustY, setFormCustY] = useState('');

  // Configuration State
  const [configWarehouseX, setConfigWarehouseX] = useState(10.8411);
  const [configWarehouseY, setConfigWarehouseY] = useState(106.8102);
  const [configMinBattery, setConfigMinBattery] = useState(30);
  const [savingConfig, setSavingConfig] = useState(false);

  // Address Geocoding State
  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [searchingAddress, setSearchingAddress] = useState(false);

  // Configuration Address Geocoding State
  const [configAddressQuery, setConfigAddressQuery] = useState('');
  const [configAddressSuggestions, setConfigAddressSuggestions] = useState([]);
  const [searchingConfigAddress, setSearchingConfigAddress] = useState(false);

  // Config Sub Tab
  const [configSubTab, setConfigSubTab] = useState('general'); // 'general', 'drones', 'orders'

  // Drone CRUD Modal States
  const [isDroneModalOpen, setIsDroneModalOpen] = useState(false);
  const [droneModalMode, setDroneModalMode] = useState('add'); // 'add' or 'edit'
  const [droneFormId, setDroneFormId] = useState('');
  const [droneFormModel, setDroneFormModel] = useState('');
  const [droneFormSize, setDroneFormSize] = useState('Medium');
  const [droneFormManufacturer, setDroneFormManufacturer] = useState('');
  const [droneFormPropellers, setDroneFormPropellers] = useState(4);
  const [droneFormMaxCarry, setDroneFormMaxCarry] = useState(5.0);
  const [droneFormX, setDroneFormX] = useState(10.8411);
  const [droneFormY, setDroneFormY] = useState(106.8102);
  const [droneFormBattery, setDroneFormBattery] = useState(100);
  const [droneFormStatus, setDroneFormStatus] = useState('Ready');

  // Order CRUD Modal States
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderModalMode, setOrderModalMode] = useState('edit'); // 'add' or 'edit'
  const [orderFormId, setOrderFormId] = useState('');
  const [orderFormWeight, setOrderFormWeight] = useState(1500);
  const [orderFormX, setOrderFormX] = useState('');
  const [orderFormY, setOrderFormY] = useState('');
  const [orderFormAddressQuery, setOrderFormAddressQuery] = useState('');
  const [orderFormAddressSuggestions, setOrderFormAddressSuggestions] = useState([]);
  const [searchingOrderFormAddress, setSearchingOrderFormAddress] = useState(false);

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

  // Fetch System Configuration
  const [fetchingConfig, setFetchingConfig] = useState(false);
  const fetchConfig = async () => {
    setFetchingConfig(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/config`);
      if (res.ok) {
        const data = await res.json();
        setConfigWarehouseX(data.warehouse_x);
        setConfigWarehouseY(data.warehouse_y);
        setConfigMinBattery(data.min_battery_level);
      }
    } catch (err) {
      console.error("Lỗi khi fetch config:", err);
    } finally {
      setFetchingConfig(false);
    }
  };

  // Run on Mount & Active Tab updates
  useEffect(() => {
    fetchOrders();
    fetchDrones();
    fetchWind();
    fetchConfig();
  }, [activeTab]);

  // Handle Address Geocoding Search (OpenStreetMap Nominatim)
  const handleSearchAddress = async (query) => {
    if (!query || query.trim().length < 3) {
      alert("Vui lòng nhập địa chỉ tìm kiếm dài hơn 3 ký tự!");
      return;
    }

    setSearchingAddress(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`, {
        headers: {
          'Accept-Language': 'vi,en;q=0.9',
          'User-Agent': 'uav-dss-dispatch-app/1.0'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.length === 0) {
          alert("Không tìm thấy tọa độ cho địa chỉ này. Vui lòng thử tìm kiếm khác.");
        }
        setAddressSuggestions(data);
      } else {
        alert("Lỗi kết nối tới dịch vụ tìm kiếm bản đồ.");
      }
    } catch (err) {
      console.error("Lỗi khi tìm kiếm địa chỉ:", err);
      alert("Không thể kết nối tới dịch vụ bản đồ.");
    } finally {
      setSearchingAddress(false);
    }
  };

  const handleSelectSuggestion = (suggestion) => {
    setFormCustX(parseFloat(suggestion.lat).toFixed(4));
    setFormCustY(parseFloat(suggestion.lon).toFixed(4));
    setAddressSearchQuery(suggestion.display_name);
    setAddressSuggestions([]);
  };

  // Handle Configuration Address Geocoding Search (OpenStreetMap Nominatim)
  const handleSearchConfigAddress = async (query) => {
    if (!query || query.trim().length < 3) {
      alert("Vui lòng nhập địa chỉ tìm kiếm dài hơn 3 ký tự!");
      return;
    }

    setSearchingConfigAddress(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`, {
        headers: {
          'Accept-Language': 'vi,en;q=0.9',
          'User-Agent': 'uav-dss-dispatch-app/1.0'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.length === 0) {
          alert("Không tìm thấy tọa độ cho địa chỉ này. Vui lòng thử tìm kiếm khác.");
        }
        setConfigAddressSuggestions(data);
      } else {
        alert("Lỗi kết nối tới dịch vụ tìm kiếm bản đồ.");
      }
    } catch (err) {
      console.error("Lỗi khi tìm kiếm địa chỉ:", err);
      alert("Không thể kết nối tới dịch vụ bản đồ.");
    } finally {
      setSearchingConfigAddress(false);
    }
  };

  const handleSelectConfigSuggestion = (suggestion) => {
    setConfigWarehouseX(parseFloat(suggestion.lat).toFixed(4));
    setConfigWarehouseY(parseFloat(suggestion.lon).toFixed(4));
    setConfigAddressQuery(suggestion.display_name);
    setConfigAddressSuggestions([]);
  };

  // Open Drone Modal
  const openDroneModal = (mode, drone = null) => {
    setDroneModalMode(mode);
    if (mode === 'edit' && drone) {
      setDroneFormId(drone.drone_id);
      setDroneFormModel(drone.drone_model);
      setDroneFormSize(drone.drone_size);
      setDroneFormManufacturer(drone.manufacturer);
      setDroneFormPropellers(drone.propeller_count);
      setDroneFormMaxCarry(drone.max_carry_weight);
      setDroneFormX(drone.Current_X);
      setDroneFormY(drone.Current_Y);
      setDroneFormBattery(drone.Battery_Level);
      setDroneFormStatus(drone.Status);
    } else {
      setDroneFormId('');
      setDroneFormModel('');
      setDroneFormSize('Medium');
      setDroneFormManufacturer('');
      setDroneFormPropellers(4);
      setDroneFormMaxCarry(5.0);
      setDroneFormX(10.8411);
      setDroneFormY(106.8102);
      setDroneFormBattery(100);
      setDroneFormStatus('Ready');
    }
    setIsDroneModalOpen(true);
  };

  // Submit Drone Form (Add/Edit)
  const handleSubmitDrone = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setNotification('');
    
    const payload = {
      drone_id: droneFormId,
      drone_model: droneFormModel,
      drone_size: droneFormSize,
      manufacturer: droneFormManufacturer,
      propeller_count: parseInt(droneFormPropellers),
      max_carry_weight: parseFloat(droneFormMaxCarry),
      current_x: parseFloat(droneFormX),
      current_y: parseFloat(droneFormY),
      battery_level: parseInt(droneFormBattery),
      status: droneFormStatus
    };

    try {
      let res;
      if (droneModalMode === 'add') {
        res = await fetch(`${API_BASE_URL}/api/drones`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_BASE_URL}/api/drones/${droneFormId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setNotification(droneModalMode === 'add' ? '🎉 Thêm drone mới thành công!' : '🎉 Cập nhật thông tin drone thành công!');
        setIsDroneModalOpen(false);
        fetchDrones();
      } else {
        const errorData = await res.json();
        setErrorMsg(errorData.detail || 'Lỗi khi gửi yêu cầu lưu thông tin drone.');
      }
    } catch (err) {
      setErrorMsg('Không thể kết nối đến máy chủ backend.');
    }
  };

  // Delete Drone
  const handleDeleteDrone = async (droneId) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa Drone ${droneId}?`)) return;
    setErrorMsg('');
    setNotification('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/drones/${droneId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setNotification('🎉 Đã xóa drone thành công khỏi hệ thống!');
        fetchDrones();
      } else {
        setErrorMsg('Lỗi khi xóa drone khỏi backend.');
      }
    } catch (err) {
      setErrorMsg('Không thể kết nối đến máy chủ backend.');
    }
  };

  // Open Order Modal
  const openOrderModal = (mode, order = null) => {
    setOrderModalMode(mode);
    setOrderFormAddressSuggestions([]);
    setOrderFormAddressQuery('');
    if (mode === 'edit' && order) {
      setOrderFormId(order.Order_ID);
      setOrderFormWeight(order.Total_Weight_Gram);
      setOrderFormX(order.Customer_X);
      setOrderFormY(order.Customer_Y);
    } else {
      setOrderFormId('');
      setOrderFormWeight(1500);
      setOrderFormX('');
      setOrderFormY('');
    }
    setIsOrderModalOpen(true);
  };

  // Search Address for Order Form in Modal
  const handleSearchOrderFormAddress = async (query) => {
    if (!query || query.trim().length < 3) {
      alert("Vui lòng nhập địa chỉ tìm kiếm dài hơn 3 ký tự!");
      return;
    }
    setSearchingOrderFormAddress(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`, {
        headers: {
          'Accept-Language': 'vi,en;q=0.9',
          'User-Agent': 'uav-dss-dispatch-app/1.0'
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.length === 0) {
          alert("Không tìm thấy tọa độ cho địa chỉ này. Vui lòng thử tìm kiếm khác.");
        }
        setOrderFormAddressSuggestions(data);
      } else {
        alert("Lỗi kết nối tới dịch vụ tìm kiếm bản đồ.");
      }
    } catch (err) {
      console.error("Lỗi khi tìm kiếm địa chỉ:", err);
      alert("Không thể kết nối tới dịch vụ bản đồ.");
    } finally {
      setSearchingOrderFormAddress(false);
    }
  };

  const handleSelectOrderFormSuggestion = (suggestion) => {
    setOrderFormX(parseFloat(suggestion.lat).toFixed(4));
    setOrderFormY(parseFloat(suggestion.lon).toFixed(4));
    setOrderFormAddressQuery(suggestion.display_name);
    setOrderFormAddressSuggestions([]);
  };

  // Submit Order Form (Add / Edit)
  const handleSubmitOrder = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setNotification('');

    if (!orderFormX || !orderFormY) {
      setErrorMsg('Vui lòng định vị địa chỉ trên bản đồ trước!');
      return;
    }

    try {
      let res;
      if (orderModalMode === 'add') {
        res = await fetch(`${API_BASE_URL}/api/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Order_ID: orderFormId || undefined,
            Customer_X: parseFloat(orderFormX),
            Customer_Y: parseFloat(orderFormY),
            Total_Weight_Gram: parseFloat(orderFormWeight)
          })
        });
      } else {
        res = await fetch(`${API_BASE_URL}/api/orders/${orderFormId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Customer_X: parseFloat(orderFormX),
            Customer_Y: parseFloat(orderFormY),
            Total_Weight_Gram: parseFloat(orderFormWeight)
          })
        });
      }

      if (res.ok) {
        setNotification(orderModalMode === 'add' ? '🎉 Thêm đơn hàng thành công!' : '🎉 Cập nhật đơn hàng thành công!');
        setIsOrderModalOpen(false);
        fetchOrders();
      } else {
        setErrorMsg('Lỗi khi lưu thông tin đơn hàng lên server.');
      }
    } catch (err) {
      setErrorMsg('Không thể kết nối đến máy chủ backend.');
    }
  };

  // Delete Order
  const handleDeleteOrder = async (orderId) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa đơn hàng ${orderId}?`)) return;
    setErrorMsg('');
    setNotification('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setNotification('🎉 Đã xóa đơn hàng thành công khỏi hệ thống!');
        fetchOrders();
      } else {
        setErrorMsg('Lỗi khi xóa đơn hàng khỏi backend.');
      }
    } catch (err) {
      setErrorMsg('Không thể kết nối đến máy chủ backend.');
    }
  };

  // Handle Order Submit
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setNotification('');

    if (!formCustX || !formCustY) {
      setErrorMsg('Vui lòng tìm kiếm và chọn một địa chỉ cụ thể trên bản đồ gợi ý để lấy tọa độ giao hàng!');
      return;
    }
    
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
        setFormCustX('');
        setFormCustY('');
        setAddressSearchQuery('');
        setAddressSuggestions([]);
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
        if (data.status === 'success' && data.recommendations.length > 0) {
          setSelectedDroneId(data.recommendations[0].Drone_ID);
        } else {
          setSelectedDroneId('');
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

  // Handle Save Configuration
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    setErrorMsg('');
    setNotification('');

    if (!configWarehouseX || !configWarehouseY) {
      setErrorMsg('Vui lòng tìm kiếm và chọn một vị trí kho hợp lệ trên bản đồ!');
      setSavingConfig(false);
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouse_x: parseFloat(configWarehouseX),
          warehouse_y: parseFloat(configWarehouseY),
          min_battery_level: parseInt(configMinBattery)
        })
      });
      
      if (res.ok) {
        setNotification('🎉 Đã cập nhật và lưu cấu hình hệ thống thành công!');
        setConfigAddressQuery('');
        setConfigAddressSuggestions([]);
        fetchConfig();
      } else {
        setErrorMsg('Lỗi khi lưu cấu hình lên server.');
      }
    } catch (err) {
      setErrorMsg('Không thể kết nối đến máy chủ backend.');
      console.error(err);
    } finally {
      setSavingConfig(false);
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
          <li 
            className={`menu-item ${activeTab === 'config' ? 'active' : ''}`}
            onClick={() => setActiveTab('config')}
          >
            ⚙️ Cấu Hình Hệ Thống
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

                <div className="form-group" style={{position: 'relative'}}>
                  <label>Địa chỉ giao hàng (Tìm kiếm bản đồ):</label>
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <input 
                      type="text" 
                      placeholder="Nhập địa chỉ giao hàng (Ví dụ: Khu công nghệ cao Quận 9, HCM...)"
                      value={addressSearchQuery}
                      onChange={(e) => setAddressSearchQuery(e.target.value)}
                    />
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{width: 'auto', padding: '0 1.5rem'}}
                      onClick={() => handleSearchAddress(addressSearchQuery)}
                      disabled={searchingAddress}
                    >
                      {searchingAddress ? <div className="spinner"></div> : 'Tìm kiếm 🔍'}
                    </button>
                  </div>
                  {addressSuggestions.length > 0 && (
                    <ul className="suggestions-list">
                      {addressSuggestions.map((s, index) => (
                        <li 
                          key={index}
                          onClick={() => handleSelectSuggestion(s)}
                          style={{listStyleType: 'none'}}
                        >
                          📍 {s.display_name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {formCustX && formCustY && (
                  <div style={{
                    marginTop: '1rem',
                    marginBottom: '1rem',
                    padding: '0.85rem 1rem',
                    background: 'rgba(0, 242, 254, 0.05)',
                    border: '1px solid rgba(0, 242, 254, 0.15)',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    color: 'var(--color-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <span>📍</span>
                    <div>
                      <strong>Tọa độ đã xác định:</strong> Vĩ độ (X): {formCustX} | Kinh độ (Y): {formCustY}
                    </div>
                  </div>
                )}

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
                ) : riskResults.status === 'no_ready_drones' ? (
                  <div className="alert alert-warning" style={{margin: 0, flexDirection: 'column', gap: '0.5rem', borderLeft: '4px solid var(--color-warning)'}}>
                    <h4 style={{color: 'var(--color-warning)', fontWeight: 'bold'}}>⚠️ KHÔNG CÓ THIẾT BỊ SẴN SÀNG:</h4>
                    <p style={{color: '#fff'}}>Hiện tại toàn bộ đội bay đang bận (Busy) hoặc bảo trì. Không tìm thấy thiết bị nào ở trạng thái <strong>Ready</strong> để cất cánh.</p>
                  </div>
                ) : riskResults.status === 'no_drones_match_criteria' ? (
                  <div className="alert alert-warning" style={{margin: 0, flexDirection: 'column', gap: '0.5rem', borderLeft: '4px solid var(--color-warning)'}}>
                    <h4 style={{color: 'var(--color-warning)', fontWeight: 'bold'}}>⚠️ THIẾT BỊ KHÔNG ĐỦ TIÊU CHUẨN:</h4>
                    <p style={{color: '#fff'}}>Tìm thấy thiết bị rảnh nhưng không có chiếc nào đáp ứng tiêu chuẩn tối thiểu về mức pin {"(>= " + configMinBattery + "%)"} hoặc tải trọng tối đa lớn hơn khối lượng đơn bưu kiện.</p>
                  </div>
                ) : riskResults.status === 'all_rejected_by_ai' ? (
                  <div className="alert alert-danger" style={{margin: 0, flexDirection: 'column', gap: '0.5rem', borderLeft: '4px solid var(--color-danger)'}}>
                    <h4 style={{color: 'var(--color-danger)', fontWeight: 'bold'}}>🔴 CẢNH BÁO BẢO AN AN TOÀN BAY:</h4>
                    <p style={{color: '#fff'}}>Bộ não AI dự báo tất cả các phương án cất cánh đều gặp nguy hiểm dưới sức gió hiện tại! Khuyến nghị chuyển sang vận tải mặt đất.</p>
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
                          {riskResults.recommendations && riskResults.recommendations.map((rec) => (
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
                        {riskResults.recommendations && riskResults.recommendations.map(rec => (
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
                            <td style={{ color: batteryColor, fontWeight: 'bold' }}>
                              {d.Battery_Level}%
                            </td>
                            <td>X: {d.Current_X} | Y: {d.Current_Y}</td>
                            <td>
                              <span className={`status-badge ${d.Status.toLowerCase() === 'ready' ? 'status-ready' : 'status-busy'}`}>
                                {d.Status}
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

        {/* ======================================= */}
        {/* SCREEN 3: SYSTEM CONFIGURATION           */}
        {/* ======================================= */}
        {activeTab === 'config' && (
          <div>
            <h1>⚙️ Cấu Hình Hệ Thống</h1>
            <p className="subtitle">Điều chỉnh các thông số vận hành động, quản lý đội bay UAV và quản lý đơn hàng của hệ thống.</p>
            
            {/* Sub Tabs Selection */}
            <div className="sub-tabs">
              <div 
                className={`sub-tab-item ${configSubTab === 'general' ? 'active' : ''}`}
                onClick={() => setConfigSubTab('general')}
              >
                ⚙️ Vận hành chung
              </div>
              <div 
                className={`sub-tab-item ${configSubTab === 'drones' ? 'active' : ''}`}
                onClick={() => setConfigSubTab('drones')}
              >
                🛸 Quản lý Đội bay UAV
              </div>
              <div 
                className={`sub-tab-item ${configSubTab === 'orders' ? 'active' : ''}`}
                onClick={() => setConfigSubTab('orders')}
              >
                📋 Quản lý Đơn hàng
              </div>
            </div>

            {/* Sub Tab 1: General Config */}
            {configSubTab === 'general' && (
              <div className="card-panel" style={{maxWidth: '700px', margin: '0 auto'}}>
                <h2 className="card-title">🔧 Cấu hình thông số động</h2>
                
                {fetchingConfig ? (
                  <div style={{padding: '2rem', display: 'flex', justifyContent: 'center'}}><div className="spinner"></div></div>
                ) : (
                  <form onSubmit={handleSaveConfig}>
                    <div className="form-group" style={{position: 'relative'}}>
                      <label>Vị trí Kho hàng trung tâm (Tìm kiếm bản đồ):</label>
                      <div style={{display: 'flex', gap: '0.5rem'}}>
                        <input 
                          type="text" 
                          placeholder="Nhập địa chỉ của kho hàng mới (Ví dụ: Khu công nghệ cao, Quận 9, HCM...)"
                          value={configAddressQuery}
                          onChange={(e) => setConfigAddressQuery(e.target.value)}
                        />
                        <button 
                          type="button" 
                          className="btn btn-secondary" 
                          style={{width: 'auto', padding: '0 1.5rem'}}
                          onClick={() => handleSearchConfigAddress(configAddressQuery)}
                          disabled={searchingConfigAddress}
                        >
                          {searchingConfigAddress ? <div className="spinner"></div> : 'Tìm kiếm 🔍'}
                        </button>
                      </div>
                      {configAddressSuggestions.length > 0 && (
                        <ul className="suggestions-list">
                          {configAddressSuggestions.map((s, index) => (
                            <li 
                              key={index}
                              onClick={() => handleSelectConfigSuggestion(s)}
                              style={{listStyleType: 'none'}}
                            >
                              📍 {s.display_name}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {configWarehouseX && configWarehouseY && (
                      <div style={{
                        marginTop: '1rem',
                        marginBottom: '1.5rem',
                        padding: '0.85rem 1rem',
                        background: 'rgba(0, 242, 254, 0.05)',
                        border: '1px solid rgba(0, 242, 254, 0.15)',
                        borderRadius: '10px',
                        fontSize: '0.9rem',
                        color: 'var(--color-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <span>🏢</span>
                        <div>
                          <strong>Tọa độ kho đã xác định:</strong> Vĩ độ (X): {configWarehouseX} | Kinh độ (Y): {configWarehouseY}
                        </div>
                      </div>
                    )}

                    <div className="form-group">
                      <label>Mức pin tối thiểu để cất cánh (%):</label>
                      <input 
                        type="number" 
                        min="10" 
                        max="90" 
                        value={configMinBattery}
                        onChange={(e) => setConfigMinBattery(e.target.value)}
                        required
                      />
                      <div className="form-hint">Drones có mức pin thấp hơn mức này sẽ không được đề xuất bay (Mặc định: 30%)</div>
                    </div>

                    <div style={{display: 'flex', gap: '1rem', marginTop: '2rem'}}>
                      <button type="submit" className="btn btn-primary" disabled={savingConfig}>
                        {savingConfig ? (
                          <>
                            <div className="spinner" style={{marginRight: '0.5rem'}}></div> Đang lưu...
                          </>
                        ) : '💾 Lưu Cấu Hình'}
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={() => {
                          setConfigWarehouseX(10.8411);
                          setConfigWarehouseY(106.8102);
                          setConfigMinBattery(30);
                          setConfigAddressQuery('');
                          setConfigAddressSuggestions([]);
                        }}
                        disabled={savingConfig}
                      >
                        Reset về mặc định
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Sub Tab 2: Drones CRUD */}
            {configSubTab === 'drones' && (
              <div className="card-panel">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                  <h2 className="card-title" style={{margin: 0}}>🛸 Quản lý Danh sách Đội thiết bị bay</h2>
                  <button className="btn btn-primary" style={{width: 'auto'}} onClick={() => openDroneModal('add')}>
                    ➕ Thêm Drone Mới
                  </button>
                </div>
                
                <div className="table-wrapper" style={{maxHeight: '500px'}}>
                  <table>
                    <thead>
                      <tr>
                        <th>Drone ID</th>
                        <th>Mẫu Thiết Bị</th>
                        <th>Kích Cỡ</th>
                        <th>Hãng SX</th>
                        <th>Số Cánh</th>
                        <th>Tải Trọng Max</th>
                        <th>Pin</th>
                        <th>Vị Trí Hiện Tại</th>
                        <th>Trạng Thái</th>
                        <th>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {drones.map((d) => (
                        <tr key={d.Drone_ID}>
                          <td><strong>{d.Drone_ID}</strong></td>
                          <td>{d.drone_model}</td>
                          <td>{d.drone_size}</td>
                          <td>{d.manufacturer}</td>
                          <td>{d.propeller_count} cánh</td>
                          <td>{d.max_carry_weight} kg</td>
                          <td>{d.Battery_Level}%</td>
                          <td>X: {d.Current_X} | Y: {d.Current_Y}</td>
                          <td>{d.Status}</td>
                          <td>
                            <div style={{display: 'flex', gap: '0.5rem'}}>
                              <button className="btn btn-secondary" style={{padding: '0.35rem 0.75rem', fontSize: '0.8rem', width: 'auto'}} onClick={() => openDroneModal('edit', d)}>Sửa</button>
                              <button className="btn btn-outline-danger" style={{padding: '0.35rem 0.75rem', fontSize: '0.8rem', width: 'auto'}} onClick={() => handleDeleteDrone(d.Drone_ID)}>Xóa</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sub Tab 3: Orders CRUD */}
            {configSubTab === 'orders' && (
              <div className="card-panel">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
                  <h2 className="card-title" style={{margin: 0}}>📋 Quản lý Hàng đợi Đơn hàng</h2>
                  <button className="btn btn-primary" style={{width: 'auto'}} onClick={() => openOrderModal('add')}>
                    ➕ Tạo Đơn Hàng Mới
                  </button>
                </div>

                <div className="table-wrapper" style={{maxHeight: '500px'}}>
                  <table>
                    <thead>
                      <tr>
                        <th>Mã Đơn hàng</th>
                        <th>Tọa độ X</th>
                        <th>Tọa độ Y</th>
                        <th>Trọng lượng</th>
                        <th>Hành động</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o.Order_ID}>
                          <td><strong>{o.Order_ID}</strong></td>
                          <td>{o.Customer_X}</td>
                          <td>{o.Customer_Y}</td>
                          <td>{(o.Total_Weight_Gram / 1000).toFixed(2)} kg ({o.Total_Weight_Gram}g)</td>
                          <td>
                            <div style={{display: 'flex', gap: '0.5rem'}}>
                              <button className="btn btn-secondary" style={{padding: '0.35rem 0.75rem', fontSize: '0.8rem', width: 'auto'}} onClick={() => openOrderModal('edit', o)}>Sửa</button>
                              <button className="btn btn-outline-danger" style={{padding: '0.35rem 0.75rem', fontSize: '0.8rem', width: 'auto'}} onClick={() => handleDeleteOrder(o.Order_ID)}>Xóa</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================= */}
        {/* MODAL: ADD / EDIT DRONE                 */}
        {/* ======================================= */}
        {isDroneModalOpen && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2 style={{marginBottom: '1rem'}}>{droneModalMode === 'add' ? '➕ Thêm Drone Mới' : '🔧 Sửa thông tin Drone'}</h2>
              <form onSubmit={handleSubmitDrone}>
                <div className="form-group">
                  <label>Mã Drone ID:</label>
                  <input 
                    type="text" 
                    value={droneFormId} 
                    onChange={(e) => setDroneFormId(e.target.value)} 
                    disabled={droneModalMode === 'edit'} 
                    required 
                    placeholder="Ví dụ: D015, D016..."
                  />
                </div>
                <div className="row">
                  <div className="col form-group">
                    <label>Mẫu thiết bị (Model):</label>
                    <input type="text" value={droneFormModel} onChange={(e) => setDroneFormModel(e.target.value)} required />
                  </div>
                  <div className="col form-group">
                    <label>Kích cỡ (Size):</label>
                    <select value={droneFormSize} onChange={(e) => setDroneFormSize(e.target.value)}>
                      <option value="Small">Small</option>
                      <option value="Medium">Medium</option>
                      <option value="Large">Large</option>
                    </select>
                  </div>
                </div>
                <div className="row">
                  <div className="col form-group">
                    <label>Hãng sản xuất:</label>
                    <input type="text" value={droneFormManufacturer} onChange={(e) => setDroneFormManufacturer(e.target.value)} required />
                  </div>
                  <div className="col form-group">
                    <label>Số cánh quạt:</label>
                    <input type="number" value={droneFormPropellers} onChange={(e) => setDroneFormPropellers(e.target.value)} min="4" max="12" required />
                  </div>
                </div>
                <div className="row">
                  <div className="col form-group">
                    <label>Tải trọng tối đa (kg):</label>
                    <input type="number" step="0.1" value={droneFormMaxCarry} onChange={(e) => setDroneFormMaxCarry(e.target.value)} min="0.1" required />
                  </div>
                  <div className="col form-group">
                    <label>Dung lượng Pin (%):</label>
                    <input type="number" value={droneFormBattery} onChange={(e) => setDroneFormBattery(e.target.value)} min="0" max="100" required />
                  </div>
                </div>
                <div className="row">
                  <div className="col form-group">
                    <label>Vĩ độ hiện tại X:</label>
                    <input type="number" step="0.0001" value={droneFormX} onChange={(e) => setDroneFormX(e.target.value)} required />
                  </div>
                  <div className="col form-group">
                    <label>Kinh độ hiện tại Y:</label>
                    <input type="number" step="0.0001" value={droneFormY} onChange={(e) => setDroneFormY(e.target.value)} required />
                  </div>
                </div>
                <div className="form-group">
                  <label>Trạng thái (Status):</label>
                  <select value={droneFormStatus} onChange={(e) => setDroneFormStatus(e.target.value)}>
                    <option value="Ready">Ready</option>
                    <option value="Busy">Busy</option>
                  </select>
                </div>
                <div style={{display: 'flex', gap: '1rem', marginTop: '2rem'}}>
                  <button type="submit" className="btn btn-primary" style={{width: '50%'}}>Lưu lại</button>
                  <button type="button" className="btn btn-secondary" style={{width: '50%'}} onClick={() => setIsDroneModalOpen(false)}>Hủy</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ======================================= */}
        {/* MODAL: ADD / EDIT ORDER                 */}
        {/* ======================================= */}
        {isOrderModalOpen && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h2 style={{marginBottom: '1rem'}}>{orderModalMode === 'add' ? '➕ Tạo Đơn Hàng Mới' : '🔧 Sửa Đơn Hàng'}</h2>
              <form onSubmit={handleSubmitOrder}>
                {orderModalMode === 'add' && (
                  <div className="form-group">
                    <label>Mã Đơn hàng (Tùy chọn):</label>
                    <input 
                      type="text" 
                      value={orderFormId} 
                      onChange={(e) => setOrderFormId(e.target.value)} 
                      placeholder="Ví dụ: ORD-099 (tự sinh nếu để trống)"
                    />
                  </div>
                )}
                <div className="form-group">
                  <label>Trọng lượng đơn hàng (Gram):</label>
                  <input 
                    type="number" 
                    value={orderFormWeight} 
                    onChange={(e) => setOrderFormWeight(e.target.value)} 
                    min="100" 
                    required 
                  />
                </div>
                
                <div className="form-group" style={{position: 'relative'}}>
                  <label>Tìm kiếm địa chỉ bản đồ:</label>
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <input 
                      type="text" 
                      placeholder="Nhập địa chỉ..." 
                      value={orderFormAddressQuery}
                      onChange={(e) => setOrderFormAddressQuery(e.target.value)}
                    />
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      style={{width: 'auto', padding: '0 1.5rem'}}
                      onClick={() => handleSearchOrderFormAddress(orderFormAddressQuery)}
                      disabled={searchingOrderFormAddress}
                    >
                      {searchingOrderFormAddress ? <div className="spinner"></div> : 'Tìm 🔍'}
                    </button>
                  </div>
                  {orderFormAddressSuggestions.length > 0 && (
                    <ul className="suggestions-list">
                      {orderFormAddressSuggestions.map((s, index) => (
                        <li 
                          key={index} 
                          onClick={() => handleSelectOrderFormSuggestion(s)}
                          style={{listStyleType: 'none'}}
                        >
                          📍 {s.display_name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {orderFormX && orderFormY && (
                  <div style={{
                    marginTop: '1rem',
                    marginBottom: '1.5rem',
                    padding: '0.85rem 1rem',
                    background: 'rgba(0, 242, 254, 0.05)',
                    border: '1px solid rgba(0, 242, 254, 0.15)',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    color: 'var(--color-accent)'
                  }}>
                    📍 Tọa độ chọn: X: {orderFormX} | Y: {orderFormY}
                  </div>
                )}

                <div style={{display: 'flex', gap: '1rem', marginTop: '2rem'}}>
                  <button type="submit" className="btn btn-primary" style={{width: '50%'}}>Xác nhận</button>
                  <button type="button" className="btn btn-secondary" style={{width: '50%'}} onClick={() => setIsOrderModalOpen(false)}>Hủy</button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
