import { Outlet } from "react-router-dom";
import { useStoreAuth } from "../../context/StoreAuthContext";
import StoreLoginPage from "./StoreLoginPage";

export default function StoreGate() {
  const { isLoggedIn } = useStoreAuth();
  if (!isLoggedIn) {
    return <StoreLoginPage />;
  }
  return <Outlet />;
}
