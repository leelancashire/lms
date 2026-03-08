import { NavLink } from "react-router-dom";

const tabs = [
  { to: "/", label: "Home", icon: "⌂" },
  { to: "/pick", label: "Pick", icon: "✦" },
  { to: "/league/default", label: "League", icon: "☰" },
  { to: "/live", label: "Live", icon: "●" },
  { to: "/profile", label: "Profile", icon: "◉" },
];

export default function NavBar() {
  return (
    <nav className="fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 border-t border-slate-700/60 bg-[#0A0E17]/80 backdrop-blur-xl">
      <ul className="grid grid-cols-5 px-2 pb-[max(env(safe-area-inset-bottom),10px)] pt-2">
        {tabs.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition ${
                  isActive ? "text-[#22D3EE]" : "text-slate-500 hover:text-slate-300"
                }`
              }
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className="font-dm text-[10px] uppercase tracking-[0.16em]">{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
