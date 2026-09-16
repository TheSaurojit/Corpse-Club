
"use client";

const stats = [
  {
    title: "Today's Revenue",
    value: "₹12,840",
    change: "+18.4%",
    icon: "₹",
  },
  {
    title: "Today's Bookings",
    value: "47",
    change: "+12.5%",
    icon: "◷",
  },
  {
    title: "Customers",
    value: "38",
    change: "+8.2%",
    icon: "♙",
  },
  {
    title: "Station Occupancy",
    value: "68%",
    change: "+5.1%",
    icon: "▣",
  },
];

const stations = [
  {
    name: "PS5 - 01",
    game: "EA FC 26",
    status: "Occupied",
    remaining: "42 min",
  },
  {
    name: "PS5 - 02",
    game: "",
    status: "Available",
    remaining: "",
  },
  {
    name: "PS5 - 03",
    game: "Tekken 8",
    status: "Occupied",
    remaining: "18 min",
  },
  {
    name: "PS5 - 04",
    game: "",
    status: "Available",
    remaining: "",
  },
  {
    name: "PS5 - 05",
    game: "",
    status: "Maintenance",
    remaining: "",
  },
  {
    name: "PS5 - 06",
    game: "NBA 2K26",
    status: "Occupied",
    remaining: "55 min",
  },
];

const bookings = [
  {
    id: "#BK-1024",
    customer: "Rahul Sharma",
    station: "PS5 - 01",
    duration: "60 min",
    controllers: 2,
    time: "06:00 PM - 07:00 PM",
    amount: "₹200",
    status: "Active",
  },
  {
    id: "#BK-1023",
    customer: "Amit Das",
    station: "PS5 - 03",
    duration: "40 min",
    controllers: 1,
    time: "05:30 PM - 06:10 PM",
    amount: "₹130",
    status: "Completed",
  },
  {
    id: "#BK-1022",
    customer: "Arjun Singh",
    station: "PS5 - 02",
    duration: "120 min",
    controllers: 2,
    time: "04:00 PM - 06:00 PM",
    amount: "₹400",
    status: "Completed",
  },
  {
    id: "#BK-1021",
    customer: "Rohit Roy",
    station: "PS5 - 04",
    duration: "20 min",
    controllers: 1,
    time: "07:30 PM - 07:50 PM",
    amount: "₹60",
    status: "Upcoming",
  },
];

export default function AdminDashboard() {
  return (
    <div>

      {/* ============================================= */}
      {/* WELCOME */}
      {/* ============================================= */}

      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          Good evening, Admin 👋
        </h1>

        <p className="mt-1 text-sm text-gray-500">
          Here's what's happening at your gaming cafe today.
        </p>
      </div>

      {/* ============================================= */}
      {/* STATS */}
      {/* ============================================= */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            {...stat}
          />
        ))}

      </div>

      {/* ============================================= */}
      {/* CHART + QUICK ACTIONS */}
      {/* ============================================= */}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">

        {/* Revenue */}
        <div className="rounded-2xl border border-white/10 bg-[#0f0f14] p-6 xl:col-span-2">

          <div className="flex items-center justify-between">

            <div>
              <h2 className="font-semibold">
                Revenue Overview
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                Revenue generated over the last 7 days
              </p>
            </div>

            <button className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-400 hover:text-white">
              Last 7 days ▾
            </button>

          </div>

          {/* Chart */}
          <div className="mt-8 h-56">

            <div className="flex h-full items-end gap-3 sm:gap-5">

              {[
                ["Mon", 45, "₹8.4K"],
                ["Tue", 62, "₹10.2K"],
                ["Wed", 51, "₹9.1K"],
                ["Thu", 78, "₹12.4K"],
                ["Fri", 68, "₹11.8K"],
                ["Sat", 92, "₹15.6K"],
                ["Sun", 75, "₹12.8K"],
              ].map(([day, height, amount]) => (
                <div
                  key={day}
                  className="group flex h-full flex-1 flex-col items-center justify-end"
                >
                  <div className="relative w-full">

                    <div
                      style={{
                        height: `${Number(height) * 1.7}px`,
                      }}
                      className="mx-auto max-w-12 rounded-t-lg bg-gradient-to-t from-purple-600/50 to-purple-400 transition-all group-hover:from-purple-500 group-hover:to-blue-400"
                    />

                    <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-md bg-white px-2 py-1 text-[10px] font-bold text-gray-900 opacity-0 transition group-hover:opacity-100">
                      {amount}
                    </div>

                  </div>

                  <span className="mt-3 text-[10px] text-gray-500">
                    {day}
                  </span>
                </div>
              ))}

            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl border border-white/10 bg-[#0f0f14] p-6">

          <h2 className="font-semibold">
            Quick Actions
          </h2>

          <p className="mt-1 text-xs text-gray-500">
            Common management actions
          </p>

          <div className="mt-6 space-y-3">

            <QuickAction
              icon="＋"
              title="Create Booking"
              description="Book a PS5 station"
            />

            <QuickAction
              icon="▣"
              title="Manage Stations"
              description="View station status"
            />

            <QuickAction
              icon="♙"
              title="Add Customer"
              description="Register a customer"
            />

            <QuickAction
              icon="₹"
              title="View Revenue"
              description="Check financial reports"
            />

          </div>
        </div>
      </div>

      {/* ============================================= */}
      {/* STATIONS */}
      {/* ============================================= */}

      <div className="mt-6 rounded-2xl border border-white/10 bg-[#0f0f14] p-6">

        <div className="flex items-center justify-between">

          <div>
            <h2 className="font-semibold">
              PS5 Stations
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Live status of all gaming stations
            </p>
          </div>

          <button className="text-xs font-medium text-purple-400 hover:text-purple-300">
            View all →
          </button>

        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">

          {stations.map((station) => (
            <StationCard
              key={station.name}
              {...station}
            />
          ))}

        </div>
      </div>

      {/* ============================================= */}
      {/* RECENT BOOKINGS */}
      {/* ============================================= */}

      <div className="mt-6 rounded-2xl border border-white/10 bg-[#0f0f14]">

        <div className="flex items-center justify-between border-b border-white/10 p-6">

          <div>
            <h2 className="font-semibold">
              Recent Bookings
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              Latest bookings from your cafe
            </p>
          </div>

          <button className="text-xs font-medium text-purple-400 hover:text-purple-300">
            View all →
          </button>

        </div>

        <div className="hidden overflow-x-auto md:block">

          <table className="w-full">

            <thead>
              <tr className="border-b border-white/10 text-left">

                {[
                  "Booking",
                  "Customer",
                  "Station",
                  "Duration",
                  "Time",
                  "Amount",
                  "Status",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-6 py-4 text-[10px] font-semibold uppercase tracking-wider text-gray-600"
                  >
                    {heading}
                  </th>
                ))}

              </tr>
            </thead>

            <tbody>

              {bookings.map((booking) => (
                <tr
                  key={booking.id}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="px-6 py-4 text-xs font-medium text-purple-400">
                    {booking.id}
                  </td>

                  <td className="px-6 py-4 text-sm font-medium">
                    {booking.customer}
                  </td>

                  <td className="px-6 py-4 text-xs text-gray-400">
                    {booking.station}
                  </td>

                  <td className="px-6 py-4">
                    <p className="text-xs text-gray-300">
                      {booking.duration}
                    </p>

                    <p className="text-[10px] text-gray-600">
                      {booking.controllers} controller
                      {booking.controllers > 1 ? "s" : ""}
                    </p>
                  </td>

                  <td className="px-6 py-4 text-xs text-gray-400">
                    {booking.time}
                  </td>

                  <td className="px-6 py-4 text-sm font-semibold">
                    {booking.amount}
                  </td>

                  <td className="px-6 py-4">
                    <StatusBadge status={booking.status} />
                  </td>
                </tr>
              ))}

            </tbody>

          </table>
        </div>

        {/* Mobile */}
        <div className="space-y-3 p-4 md:hidden">

          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
            >

              <div className="flex items-start justify-between">

                <div>
                  <p className="text-xs font-semibold text-purple-400">
                    {booking.id}
                  </p>

                  <p className="mt-2 text-sm font-semibold">
                    {booking.customer}
                  </p>
                </div>

                <StatusBadge status={booking.status} />

              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">

                <div>
                  <p className="text-gray-600">
                    Station
                  </p>

                  <p className="mt-1 text-gray-300">
                    {booking.station}
                  </p>
                </div>

                <div>
                  <p className="text-gray-600">
                    Duration
                  </p>

                  <p className="mt-1 text-gray-300">
                    {booking.duration}
                  </p>
                </div>

                <div>
                  <p className="text-gray-600">
                    Time
                  </p>

                  <p className="mt-1 text-gray-300">
                    {booking.time}
                  </p>
                </div>

                <div>
                  <p className="text-gray-600">
                    Amount
                  </p>

                  <p className="mt-1 font-semibold text-white">
                    {booking.amount}
                  </p>
                </div>

              </div>
            </div>
          ))}

        </div>
      </div>

    </div>
  );
}

/* ================================================= */
/* STAT CARD */
/* ================================================= */

function StatCard({
  title,
  value,
  change,
  icon,
}: {
  title: string;
  value: string;
  change: string;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f0f14] p-5 transition hover:border-purple-500/20">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-xs text-gray-500">
            {title}
          </p>

          <h3 className="mt-3 text-2xl font-bold">
            {value}
          </h3>

          <p className="mt-2 text-[11px]">
            <span className="font-semibold text-emerald-400">
              {change}
            </span>

            <span className="ml-1 text-gray-600">
              vs last week
            </span>
          </p>

        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-lg text-purple-400">
          {icon}
        </div>

      </div>
    </div>
  );
}

/* ================================================= */
/* QUICK ACTION */
/* ================================================= */

function QuickAction({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <button className="flex w-full items-center gap-4 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-left transition hover:border-purple-500/20 hover:bg-purple-500/5">

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
        {icon}
      </div>

      <div>
        <p className="text-sm font-medium">
          {title}
        </p>

        <p className="mt-1 text-[10px] text-gray-600">
          {description}
        </p>
      </div>

      <span className="ml-auto text-gray-600">
        →
      </span>

    </button>
  );
}

/* ================================================= */
/* STATION CARD */
/* ================================================= */

function StationCard({
  name,
  game,
  status,
  remaining,
}: {
  name: string;
  game: string;
  status: string;
  remaining: string;
}) {
  const statusStyles = {
    Available: {
      badge: "bg-emerald-500/10 text-emerald-400",
      icon: "bg-emerald-500/10 text-emerald-400",
    },
    Occupied: {
      badge: "bg-purple-500/10 text-purple-400",
      icon: "bg-purple-500/10 text-purple-400",
    },
    Maintenance: {
      badge: "bg-orange-500/10 text-orange-400",
      icon: "bg-orange-500/10 text-orange-400",
    },
  };

  const style =
    statusStyles[
      status as keyof typeof statusStyles
    ] ?? statusStyles.Available;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-purple-500/30">

      <div className="flex items-start justify-between">

        <div className="flex items-center gap-3">

          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${style.icon}`}
          >
            🎮
          </div>

          <div>
            <p className="text-sm font-semibold">
              {name}
            </p>

            <p className="mt-1 text-[11px] text-gray-500">
              {game || "Ready to play"}
            </p>
          </div>

        </div>

        <span
          className={`rounded-full px-2 py-1 text-[9px] font-semibold ${style.badge}`}
        >
          {status}
        </span>

      </div>

      {status === "Occupied" && (
        <div className="mt-4">

          <div className="mb-2 flex justify-between text-[10px]">

            <span className="text-gray-500">
              Remaining
            </span>

            <span className="text-purple-400">
              {remaining}
            </span>

          </div>

          <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
            <div className="h-full w-[65%] rounded-full bg-gradient-to-r from-purple-500 to-blue-500" />
          </div>

        </div>
      )}

    </div>
  );
}

/* ================================================= */
/* STATUS */
/* ================================================= */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<string, string> = {
    Active:
      "bg-purple-500/10 text-purple-400 border-purple-500/20",

    Completed:
      "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",

    Upcoming:
      "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${
        styles[status] ??
        "bg-gray-500/10 text-gray-400 border-gray-500/20"
      }`}
    >
      {status}
    </span>
  );
}
