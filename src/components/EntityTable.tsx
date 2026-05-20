interface TableData {
  status: string
  satuan: string
  rkap: number
  realisasi: number
}

interface EntityTableProps {
  data: TableData[]
}

export default function EntityTable({
  data,
}: EntityTableProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-blue-700 text-white">
            <th className="p-4 text-left">Status SDM</th>
            <th className="p-4 text-left">Satuan</th>
            <th className="p-4 text-center">RKAP 2025</th>
            <th className="p-4 text-center">Realisasi</th>
            <th className="p-4 text-center">Selisih</th>
            <th className="p-4 text-center">Capaian</th>
          </tr>
        </thead>

        <tbody>
          {data.map((item, index) => {
            const selisih =
              item.realisasi - item.rkap

            const capaian =
              item.rkap > 0
                ? (
                    (item.realisasi / item.rkap) *
                    100
                  ).toFixed(0)
                : 0

            return (
              <tr
                key={index}
                className="border-b"
              >
                <td className="p-4">
                  {item.status}
                </td>

                <td className="p-4">
                  {item.satuan}
                </td>

                <td className="p-4 text-center">
                  {item.rkap}
                </td>

                <td className="p-4 text-center">
                  {item.realisasi}
                </td>

                <td className="p-4 text-center">
                  {selisih}
                </td>

                <td className="p-4 text-center">
                  {capaian}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}