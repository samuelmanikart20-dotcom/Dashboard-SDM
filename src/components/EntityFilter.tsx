interface EntityFilterProps {
  selectedEntity: string
  setSelectedEntity: (value: string) => void
}

export default function EntityFilter({
  selectedEntity,
  setSelectedEntity,
}: EntityFilterProps) {
  const entities = [
    "SEMUA",
    "SPMT",
    "PTP",
    "IKT",
    "TCU",
  ]

  return (
    <select
      value={selectedEntity}
      onChange={(e) => setSelectedEntity(e.target.value)}
      className="bg-blue-500 text-white px-4 py-2 rounded-lg outline-none"
    >
      {entities.map((entity) => (
        <option
          key={entity}
          value={entity}
          className="text-black"
        >
          {entity}
        </option>
      ))}
    </select>
  )
}