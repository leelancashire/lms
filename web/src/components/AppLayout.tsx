import { Outlet, useLocation } from "react-router-dom";
import NavBar from "./NavBar";

export default function AppLayout() {
  const location = useLocation();

  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#0A0E17] pb-24">
      <div key={location.pathname} className="page-enter">
        <Outlet />
      </div>
      <NavBar />
    </div>
  );
}
