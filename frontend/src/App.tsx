import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CustomerAuthProvider } from "./context/CustomerAuthContext";
import { StoreAuthProvider } from "./context/StoreAuthContext";
import Home from "./pages/Home";
import CustomerGate from "./pages/customer/CustomerGate";
import OrderingPage from "./pages/customer/OrderingPage";
import OrderHistoryPage from "./pages/customer/OrderHistoryPage";
import StoreGate from "./pages/store/StoreGate";
import StoreLayout from "./pages/store/StoreLayout";
import OrderBoardPage from "./pages/store/OrderBoardPage";
import KitchenDisplayPage from "./pages/store/KitchenDisplayPage";
import CheckoutPage from "./pages/store/CheckoutPage";
import ProductManagementPage from "./pages/store/ProductManagementPage";
import ReportsPage from "./pages/store/ReportsPage";

export default function App() {
  return (
    <CustomerAuthProvider>
      <StoreAuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Home />} />

            <Route path="/order" element={<CustomerGate />}>
              <Route index element={<OrderingPage />} />
              <Route path="history" element={<OrderHistoryPage />} />
            </Route>

            <Route path="/store" element={<StoreGate />}>
              <Route element={<StoreLayout />}>
                <Route index element={<OrderBoardPage />} />
                <Route path="kitchen" element={<KitchenDisplayPage />} />
                <Route path="checkout" element={<CheckoutPage />} />
                <Route path="products" element={<ProductManagementPage />} />
                <Route path="reports" element={<ReportsPage />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </StoreAuthProvider>
    </CustomerAuthProvider>
  );
}
