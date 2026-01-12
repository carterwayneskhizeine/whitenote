
import { getGraphData } from "@/actions/graph"
import { GraphView } from "@/components/GraphView"

export default async function TagsPage() {
  const data = await getGraphData()

  return (
    <div className="h-[calc(100vh)] w-full overflow-hidden bg-[#161616] flex flex-col relative">
      <div className="absolute top-4 left-4 z-50 pointer-events-none">
        <h1 className="text-white text-xl font-bold bg-black/50 px-3 py-1 rounded backdrop-blur-md">
          Knowledge Graph
        </h1>
      </div>
      <GraphView data={data} className="flex-1" />
    </div>
  )
}
