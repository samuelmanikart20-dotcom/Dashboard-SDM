interface SummaryCardsProps {
  totalSDM: number
  organik: number
  pkwt: number
  tad: number
}

export default function SummaryCards({
  totalSDM,
  organik,
  pkwt,
  tad,
}: SummaryCardsProps) {
  const cards = [
    {
      title: "Total SDM",
      value: totalSDM,
    },
    {
      title: "Organik",
      value: organik,
    },
    {
      title: "PKWT",
      value: pkwt,
    },
    {
      title: "TAD",
      value: tad,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {cards.map((card, index) => (
        <div
          key={index}
          className="bg-white rounded-xl shadow-sm border p-5"
        >
          <p className="text-gray-500 text-sm mb-2">
            {card.title}
          </p>

          <h2 className="text-3xl font-bold text-gray-800">
            {card.value}
          </h2>
        </div>
      ))}
    </div>
  )
}