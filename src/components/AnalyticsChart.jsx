"use client";

import { useEffect, useState } from "react";

export default function AnalyticsChart() {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch("/api/admin/analytics/sdm") // ✅ INI DIA
      .then((res) => res.json())
      .then((res) => {
        setData(res.data);
      });
  }, []);

  return <div>Chart disini</div>;
}