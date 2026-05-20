interface Props {
  data: any[]
}

export default function MutasiTable({
  data,
}: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-blue-700 text-white">
            <th className="p-4 text-left">
              Nama
            </th>

            <th className="p-4 text-left">
              Dari
            </th>

            <th className="p-4 text-left">
              Ke
            </th>

            <th className="p-4 text-left">
              Jenis
            </th>

            <th className="p-4 text-left">
              Tanggal
            </th>
          </tr>
        </thead>

        <tbody>
          {data.map((item, index) => (
            <tr
              key={index}
              className="border-b"
            >
              <td className="p-4">
                {item.nama}
              </td>

              <td className="p-4">
                {item.entitas_asal}
              </td>

              <td className="p-4">
                {item.entitas_tujuan}
              </td>

              <td className="p-4">
                {item.jenis_mutasi}
              </td>

              <td className="p-4">
                {item.tanggal_mutasi}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}