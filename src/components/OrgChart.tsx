"use client";

import React, {
  useMemo,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  Position,
  NodeMouseHandler,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";

// Component untuk foto profil dengan error handling yang baik
const ProfilePhoto = ({
  photoUrl,
  label,
}: {
  photoUrl?: string;
  label?: string;
}) => {
  const [hasError, setHasError] = useState(false);

  if (!photoUrl || hasError) {
    return (
      <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border-2 flex-shrink-0 bg-blue-100 text-blue-700 border-blue-200">
        {label?.slice(0, 2)?.toUpperCase() || "?"}
      </div>
    );
  }

  return (
    <img
      src={photoUrl}
      alt={label || "Foto"}
      className="w-14 h-14 rounded-full object-cover border-2 shadow flex-shrink-0 border-blue-200"
      onError={() => {
        // Silently handle error - photo file may not exist
        setHasError(true);
      }}
    />
  );
};

// Default edge options - defined outside component to prevent re-creation
const defaultEdgeOptions = {
  type: "step" as const,
  animated: false,
  style: {
    strokeWidth: 3, // Tebalkan garis edge
    stroke: "#374151", // Warna abu-abu gelap
  },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 25,
    height: 25,
    color: "#374151",
  },
};

export type OrgItem = {
  id: string;
  parentId?: string | null; // Single parent (backward compatibility)
  parentIds?: string[]; // Multiple parents for shared subordinate scenario
  label: string; // Person/Position main label
  subtitle?: string; // Typically position name
  photoUrl?: string;
  positionTitle?: string;
  unit?: string;
  nipp?: string;
  badgeColor?: string; // e.g., '#1E40AF'
  no_hp?: string;
  tmt_jabatan?: string;
  periode_jabatan?: string;
  kj_individu?: string;
  kj_posisi?: string;
};

interface OrgChartProps {
  items: OrgItem[];
  direction?: "TB" | "LR"; // top-bottom or left-right
  onNodeClick?: (nodeId: string) => void;
  sortMode?: "alpha" | "input";
  divisi?: "SPMT" | "PTP" | "IKT" | "TCU"; // Untuk menentukan spacing yang berbeda per divisi
}

export interface OrgChartRef {
  fitView: () => void;
}

// Internal component that uses ReactFlow hooks
const OrgChartInternal = forwardRef<OrgChartRef, OrgChartProps>(
  (
    {
      items,
      direction = "TB",
      onNodeClick,
      sortMode = "alpha",
      divisi = "SPMT",
    },
    ref
  ) => {
    const { nodes, edges } = useMemo(() => {
      const result = layoutTree(items, direction, sortMode, divisi);
      // Log hanya jika jumlah nodes/edges berubah secara signifikan
      if (result.nodes.length !== items.length) {
        console.log(
          `[OrgChart] Generated ${result.nodes.length} nodes and ${result.edges.length} edges from ${items.length} items`
        );
      }
      return result;
    }, [items, direction, sortMode, divisi]);

    const { fitView } = useReactFlow();

    useImperativeHandle(ref, () => ({
      fitView: () => {
        setTimeout(() => {
          fitView({ padding: 0.1, duration: 0 });
        }, 100);
      },
    }));

    const handleNodeClick: NodeMouseHandler | undefined = onNodeClick
      ? (_evt, node) => onNodeClick(node.id)
      : undefined;

    // PERBAIKAN: Gunakan useRef untuk track nodes/edges sebelumnya dan hanya fit view jika benar-benar berubah
    const prevNodesLengthRef = useRef(0);
    const prevEdgesLengthRef = useRef(0);

    useEffect(() => {
      // Auto fit view when nodes change (hanya jika jumlah nodes/edges benar-benar berubah)
      const nodesChanged = nodes.length !== prevNodesLengthRef.current;
      const edgesChanged = edges.length !== prevEdgesLengthRef.current;

      if (nodesChanged || edgesChanged) {
        prevNodesLengthRef.current = nodes.length;
        prevEdgesLengthRef.current = edges.length;

        if (nodes.length > 0) {
          // Fit view hanya jika nodes/edges benar-benar berubah
          setTimeout(() => {
            fitView({ padding: 0.1, duration: 0 });
          }, 300);
        }
      }
    }, [nodes.length, edges.length, fitView]); // PERBAIKAN: Gunakan nodes.length dan edges.length, bukan nodes/edges object

    return (
      <div
        className="h-[70vh] w-full bg-white"
        style={{ position: "relative" }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          onNodeClick={handleNodeClick}
          defaultEdgeOptions={defaultEdgeOptions}
          proOptions={{ hideAttribution: true }}
        >
          <Controls showInteractive={false} />
          <Background gap={16} color="#f3f4f6" />
        </ReactFlow>
      </div>
    );
  }
);

OrgChartInternal.displayName = "OrgChartInternal";

// Simple tree layout without external libs: compute levels and x positions by sibling order
function layoutTree(
  items: OrgItem[],
  direction: "TB" | "LR" = "TB",
  sortMode: "alpha" | "input" = "alpha",
  divisi: "SPMT" | "PTP" | "IKT" | "TCU" = "SPMT"
): { nodes: Node[]; edges: Edge[] } {
  const idToItem = new Map(items.map((it) => [it.id, it]));

  const childrenMap = new Map<string, OrgItem[]>();
  const roots: OrgItem[] = [];
  const sharedSubordinates = new Map<string, OrgItem>(); // childId -> child item dengan multiple parents

  // Build childrenMap dan detect shared subordinates
  for (const item of items) {
    // Handle multiple parents (parentIds array)
    if (item.parentIds && item.parentIds.length > 0) {
      // Shared subordinate: memiliki multiple parents
      // PERBAIKAN: Untuk TCU, parentIds mungkin berisi ID POSISI SAP asli, bukan unique ID
      // Jadi perlu cek apakah parent ada di idToItem dengan berbagai format
      const validParentIds = item.parentIds.filter((pid) => {
        const trimmed = pid.trim();
        if (!trimmed) return false;

        // Cek langsung di idToItem
        if (idToItem.has(trimmed)) return true;

        // PERBAIKAN: Untuk TCU, cek juga apakah ada item dengan ID yang mengandung ID POSISI SAP ini
        // (karena TCU menggunakan format unique ID: sapId|direktorat)
        if (divisi === "TCU") {
          // Cari di semua items apakah ada yang ID-nya mengandung ID POSISI SAP parent
          for (const itemId of idToItem.keys()) {
            // Jika item ID adalah format unique (sapId|direktorat), cek bagian sapId-nya
            if (itemId.includes("|")) {
              const sapIdPart = itemId.split("|")[0];
              if (sapIdPart === trimmed) return true;
            }
            // Atau jika item ID sama dengan trimmed
            if (itemId === trimmed) return true;
          }
        }

        return false;
      });

      if (validParentIds.length >= 2) {
        // Simpan sebagai shared subordinate (minimal 2 parents)
        // PENTING: JANGAN tambahkan ke childrenMap agar tidak ditempatkan sebagai child normal
        sharedSubordinates.set(item.id, item);
      } else if (validParentIds.length === 1) {
        // Hanya 1 parent valid, gunakan sebagai single parent (backward compatibility)
        const pid = validParentIds[0].trim();
        if (!childrenMap.has(pid)) childrenMap.set(pid, []);
        childrenMap.get(pid)!.push(item);
      } else {
        // Tidak ada parent yang valid, jadi root
        roots.push(item);
      }
    }
    // Handle single parent (backward compatibility)
    else {
      const pid = (item.parentId ?? "").toString().trim();
      if (!pid || !idToItem.has(pid)) {
        roots.push(item);
      } else {
        // PENTING: Skip jika item ini adalah shared subordinate (sudah ditangani di atas)
        if (!sharedSubordinates.has(item.id)) {
          if (!childrenMap.has(pid)) childrenMap.set(pid, []);
          childrenMap.get(pid)!.push(item);
        }
      }
    }
  }

  // Sort children: non-vacant diurutkan abjad di atas, vacant di bawah
  const isVacantItem = (item: OrgItem) =>
    !item.label || item.label.trim() === "" || item.label === "-";

  for (const [, arr] of childrenMap) {
    arr.sort((a, b) => {
      const aVacant = isVacantItem(a);
      const bVacant = isVacantItem(b);

      // Vacant selalu di bawah
      if (aVacant && !bVacant) return 1;
      if (!aVacant && bVacant) return -1;

      // Jika keduanya vacant atau keduanya non-vacant, sort alfabetis
      return (a.label || a.id).localeCompare(b.label || b.id);
    });
  }

  roots.sort((a, b) => {
    const aVacant = isVacantItem(a);
    const bVacant = isVacantItem(b);

    // Vacant selalu di bawah
    if (aVacant && !bVacant) return 1;
    if (!aVacant && bVacant) return -1;

    // Jika keduanya vacant atau keduanya non-vacant, sort alfabetis
    return (a.label || a.id).localeCompare(b.label || b.id);
  });

  // Perform DFS to assign positions
  const nodeWidth = 240; // Lebar node diperkecil lagi
  const nodeHeight = 180; // Tinggi node diperbesar (lebih panjang)
  // PERBAIKAN: Spacing berbeda per divisi
  // TCU memerlukan spacing lebih besar karena struktur lebih kompleks dengan banyak children
  let hSpacing: number;
  let vSpacing: number;
  let gridRowSpacing: number; // Jarak vertikal antar baris dalam grid layout
  let gridHSpacing: number; // Jarak horizontal khusus untuk grid layout (anak > 4)

  if (divisi === "TCU") {
    // TCU: spacing lebih kecil untuk mendekatkan node
    hSpacing = 180; // horizontal spacing between siblings - didekatkan lagi
    vSpacing = 240; // vertical spacing between levels - diperbesar sedikit
    gridRowSpacing = 350; // Jarak vertikal antar baris dalam grid - dikurangi sedikit
    gridHSpacing = 200; // Jarak horizontal untuk grid layout
  } else {
    // SPMT, PTP, IKT: spacing horizontal lebih berjarak
    hSpacing = 150; // horizontal spacing between siblings - berjarak
    vSpacing = 220; // vertical spacing between levels - diperbesar sedikit
    gridRowSpacing = 300; // Jarak vertikal antar baris dalam grid - ditambahkan jaraknya
    gridHSpacing = 200; // Jarak horizontal untuk grid layout (lebih besar dari hSpacing normal)
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Track x cursor per depth to avoid overlap
  // PERBAIKAN: Gunakan global cursor untuk setiap depth, bukan reset per subtree
  const depthNextX = new Map<number, number>();

  const ensureNextX = (depth: number) => {
    if (!depthNextX.has(depth)) depthNextX.set(depth, 0);
    return depthNextX.get(depth)!;
  };

  const advanceX = (depth: number, amount: number) => {
    depthNextX.set(depth, ensureNextX(depth) + amount);
  };

  const placeSubtree = (
    item: OrgItem,
    depth: number,
    startX?: number // Optional starting x position untuk subtree ini
  ): { xCenter: number; width: number; rightEdge: number } => {
    const kids = childrenMap.get(item.id) || [];
    const hasChildren = kids.length > 0;

    if (!hasChildren) {
      // Leaf node: place at current cursor position atau startX jika diberikan
      const x = startX !== undefined ? startX : ensureNextX(depth);
      const xCenter = x + nodeWidth / 2;
      // Pastikan spacing vertikal cukup dengan menambahkan nodeHeight
      const y = depth === 0 ? 0 : depth * (nodeHeight + vSpacing);
      nodes.push(makeNode(item, x, y, direction));
      const rightEdge = x + nodeWidth;
      // Update cursor hanya jika tidak menggunakan startX
      if (startX === undefined) {
        advanceX(depth, nodeWidth + hSpacing);
      }
      return { xCenter, width: nodeWidth, rightEdge };
    }

    // GRID LAYOUT: Jika lebih dari 4 children, gunakan grid 3 per baris
    // Berlaku untuk SEMUA tingkatan termasuk tingkat 1 (depth 0)
    const maxChildrenPerRow = 3;
    const useGridLayout = kids.length > 4;

    let subtreeWidth = 0;
    let firstCenter = 0;
    let lastCenter = 0;
    let maxRightEdge = startX !== undefined ? startX : ensureNextX(depth + 1);
    let firstChildLeft = 0;
    let lastChildRight = 0;
    const childStartX = startX !== undefined ? startX : ensureNextX(depth + 1);

    if (useGridLayout) {
      // Grid Layout: 3 children per baris dengan Orthogonal Routing dan Side Entry
      // Berlaku untuk SEMUA tingkatan termasuk tingkat 1 (depth 0)
      const gridWidth =
        maxChildrenPerRow * (nodeWidth + gridHSpacing) - gridHSpacing;
      // Untuk anak lebih dari 4, gunakan jarak vertikal yang lebih besar
      const rowSpacing = kids.length > 4 
        ? gridRowSpacing * 1.5 // Tambah 50% jarak untuk anak lebih dari 4
        : gridRowSpacing; // Gunakan gridRowSpacing normal untuk jarak vertikal antar baris

      // Group children by column untuk shared vertical bus
      const childrenByColumn = new Map<
        number,
        Array<{ kid: OrgItem; idx: number }>
      >();

      kids.forEach((kid, idx) => {
        const col = idx % maxChildrenPerRow;

        if (!childrenByColumn.has(col)) {
          childrenByColumn.set(col, []);
        }
        childrenByColumn.get(col)!.push({ kid, idx });
      });

      // Place all children first
      kids.forEach((kid, idx) => {
        const row = Math.floor(idx / maxChildrenPerRow);
        const col = idx % maxChildrenPerRow;

        const x = childStartX + col * (nodeWidth + gridHSpacing);
        const xCenter = x + nodeWidth / 2;

        const baseY = (depth + 1) * (nodeHeight + vSpacing);
        const y = baseY + row * rowSpacing;

        nodes.push(makeNode(kid, x, y, direction));

        // Process children of this child recursively
        const childKids = childrenMap.get(kid.id) || [];
        if (childKids.length > 0) {
          placeSubtree(kid, depth + 1, x);
        }

        const rightEdge = x + nodeWidth;

        if (idx === 0) {
          firstCenter = xCenter;
          firstChildLeft = x;
          lastChildRight = rightEdge;
        } else {
          lastCenter = xCenter;
          lastChildRight = Math.max(lastChildRight, rightEdge);
        }
        maxRightEdge = Math.max(maxRightEdge, rightEdge);
      });

      // Create edges dengan Orthogonal Routing dan Side Entry
      // Shared Vertical Bus: edge dari parent ke setiap child dengan side entry
      childrenByColumn.forEach((columnChildren, col) => {
        // Tentukan source handle: Kolom 0,1 dari kiri | Kolom 2 dari kanan
        const sourceHandle = col === 2 ? "right-source" : "left-source";
        // Target handle: Kolom 0,1 masuk dari kiri | Kolom 2 masuk dari kanan
        const targetHandle = col === 2 ? "right" : "left";

        columnChildren.forEach(({ kid }) => {
          edges.push(
            makeEdge(item.id, kid.id, direction, sourceHandle, targetHandle)
          );
        });
      });

      subtreeWidth = gridWidth;
      const gridCenterX = childStartX + gridWidth / 2;
      const xCenter = gridCenterX;
      const x = xCenter - nodeWidth / 2;
      const y = depth === 0 ? 0 : depth * (nodeHeight + vSpacing);
      nodes.push(makeNode(item, x, y, direction));

      const parentNextX = ensureNextX(depth);
      const parentRightEdge = Math.max(x + nodeWidth, maxRightEdge);
      depthNextX.set(depth, Math.max(parentNextX, parentRightEdge + hSpacing));
      depthNextX.set(depth + 1, childStartX + gridWidth + hSpacing);

      return {
        xCenter,
        width: Math.max(subtreeWidth, nodeWidth),
        rightEdge: parentRightEdge,
      };
    } else {
      // Normal Layout: untuk 4 atau kurang children (layout horizontal biasa)
      // SPECIAL CASE: Hanya untuk TCU - Jika ada 2 children, gunakan layout khusus: child pertama di kiri, child kedua di tengah
      const useSpecialTwoChildrenLayout = divisi === "TCU" && kids.length === 2;

      if (useSpecialTwoChildrenLayout) {
        // Layout khusus untuk 2 children: pertama di kiri, kedua di tengah (di bawah parent)
        const firstChild = kids[0];
        const secondChild = kids[1];

        // Place first child di kiri
        const firstChildX = childStartX;
        const firstChildPlaced = placeSubtree(
          firstChild,
          depth + 1,
          firstChildX
        );
        firstCenter = firstChildPlaced.xCenter;
        firstChildLeft = firstChildPlaced.xCenter - firstChildPlaced.width / 2;

        // Hitung posisi parent: cukup jauh dari first child agar tidak overlap
        // Parent akan di tengah, jadi kita perlu tahu lebar subtree first child dulu
        const minSpacingFromFirstChild = hSpacing * 3; // Spacing cukup besar
        const estimatedParentXCenter =
          firstChildPlaced.rightEdge + minSpacingFromFirstChild + nodeWidth / 2;

        // Place second child di tengah (di bawah parent, aligned dengan estimated parent center)
        const secondChildX = estimatedParentXCenter - nodeWidth / 2;
        // Pastikan second child tidak overlap dengan first child
        const safeSecondChildX = Math.max(
          secondChildX,
          firstChildPlaced.rightEdge + hSpacing
        );
        const secondChildPlaced = placeSubtree(
          secondChild,
          depth + 1,
          safeSecondChildX
        );

        // Recalculate parent position based on actual second child position
        // Parent harus di tengah (di atas second child)
        const actualParentXCenter = secondChildPlaced.xCenter;
        const actualParentX = actualParentXCenter - nodeWidth / 2;

        lastCenter = secondChildPlaced.xCenter;
        lastChildRight = Math.max(
          secondChildPlaced.rightEdge,
          firstChildPlaced.rightEdge
        );

        // Place parent di tengah (di atas second child)
        const y = depth === 0 ? 0 : depth * (nodeHeight + vSpacing);
        nodes.push(makeNode(item, actualParentX, y, direction));

        // Create edges dengan routing khusus
        // Edge dari parent ke first child: turun lalu belok kiri
        edges.push(
          makeEdge(item.id, firstChild.id, direction, "left-source", "left")
        );
        // Edge dari parent ke second child: turun lurus ke tengah
        edges.push(makeEdge(item.id, secondChild.id, direction));

        subtreeWidth = Math.max(
          lastChildRight - firstChildLeft,
          secondChildPlaced.width,
          nodeWidth,
          actualParentX + nodeWidth - firstChildLeft
        );
        maxRightEdge = Math.max(
          firstChildPlaced.rightEdge,
          secondChildPlaced.rightEdge,
          actualParentX + nodeWidth
        );

        const parentNextX = ensureNextX(depth);
        const parentRightEdge = Math.max(
          actualParentX + nodeWidth,
          maxRightEdge
        );
        depthNextX.set(
          depth,
          Math.max(parentNextX, parentRightEdge + hSpacing)
        );
        // Update cursor untuk depth + 1 agar tidak overlap dengan children berikutnya
        depthNextX.set(
          depth + 1,
          Math.max(
            firstChildPlaced.rightEdge + hSpacing,
            secondChildPlaced.rightEdge + hSpacing
          )
        );

        return {
          xCenter: actualParentXCenter,
          width: Math.max(subtreeWidth, nodeWidth),
          rightEdge: parentRightEdge,
        };
      } else {
        // Layout normal untuk 1, 3, atau 4 children
        kids.forEach((kid, idx) => {
          const childX = idx === 0 ? childStartX : ensureNextX(depth + 1);
          const childPlaced = placeSubtree(kid, depth + 1, childX);

          if (idx === 0) {
            firstCenter = childPlaced.xCenter;
            firstChildLeft = childPlaced.xCenter - childPlaced.width / 2;
            lastChildRight = childPlaced.rightEdge;
          } else {
            lastCenter = childPlaced.xCenter;
            lastChildRight = Math.max(lastChildRight, childPlaced.rightEdge);
          }
          maxRightEdge = Math.max(maxRightEdge, childPlaced.rightEdge);
          edges.push(makeEdge(item.id, kid.id, direction));

          depthNextX.set(depth + 1, childPlaced.rightEdge + hSpacing);
        });

        subtreeWidth = Math.max(lastChildRight - firstChildLeft, nodeWidth);
        const xCenter =
          kids.length === 1 ? firstCenter : (firstCenter + lastCenter) / 2;
        const x = xCenter - nodeWidth / 2;
        const y = depth === 0 ? 0 : depth * (nodeHeight + vSpacing);
        nodes.push(makeNode(item, x, y, direction));

        const parentNextX = ensureNextX(depth);
        const parentRightEdge = Math.max(x + nodeWidth, maxRightEdge);
        depthNextX.set(
          depth,
          Math.max(parentNextX, parentRightEdge + hSpacing)
        );

        return {
          xCenter,
          width: Math.max(subtreeWidth, nodeWidth),
          rightEdge: parentRightEdge,
        };
      }
    }
  };

  // PERBAIKAN: Place roots dengan spacing yang cukup
  roots.forEach((r) => {
    // Pastikan cursor di depth 0 sudah di posisi yang benar
    ensureNextX(0);
    const result = placeSubtree(r, 0);
    // Pastikan cursor bergerak cukup jauh setelah setiap root untuk mencegah overlap
    const currentX = ensureNextX(0);
    depthNextX.set(0, Math.max(currentX, result.rightEdge + hSpacing));
  });

  // Handle shared subordinates: nodes dengan multiple parents
  // Posisikan di tengah-tengah parents mereka dan buat edges dari semua parents
  // PERBAIKAN: Hanya untuk TCU - positioning khusus di tengah antara parents
  const nodePositionMap = new Map<
    string,
    { x: number; y: number; xCenter: number }
  >();
  nodes.forEach((node) => {
    nodePositionMap.set(node.id, {
      x: node.position.x,
      y: node.position.y,
      xCenter: node.position.x + nodeWidth / 2,
    });
  });

  sharedSubordinates.forEach((sharedChild, childId) => {
    if (!sharedChild.parentIds || sharedChild.parentIds.length < 2) return;

    // Cari posisi semua parents yang valid
    const parentPositions: { id: string; xCenter: number; y: number }[] = [];
    sharedChild.parentIds.forEach((pid) => {
      const trimmed = pid.trim();
      let parentPos = nodePositionMap.get(trimmed);

      // PERBAIKAN: Untuk TCU, jika parent tidak ditemukan dengan ID langsung,
      // coba cari berdasarkan ID POSISI SAP (karena TCU menggunakan format unique ID: sapId|direktorat)
      if (!parentPos && divisi === "TCU") {
        // Cari node yang ID-nya mengandung ID POSISI SAP parent
        const parentNode = nodes.find((n) => {
          // Untuk TCU, node ID format: sapId|direktorat
          // parentIds mungkin berisi ID POSISI SAP asli atau unique ID
          if (n.id === trimmed) return true;
          if (n.id.includes("|")) {
            const sapIdPart = n.id.split("|")[0];
            if (sapIdPart === trimmed) return true;
          }
          if (n.id.startsWith(trimmed + "|")) return true;
          if (n.id.endsWith("|" + trimmed)) return true;
          return false;
        });
        if (parentNode) {
          parentPos = {
            x: parentNode.position.x,
            y: parentNode.position.y,
            xCenter: parentNode.position.x + nodeWidth / 2,
          };
          // Update nodePositionMap untuk referensi selanjutnya
          nodePositionMap.set(trimmed, parentPos);
        }
      }

      if (parentPos) {
        parentPositions.push({
          id: trimmed,
          xCenter: parentPos.xCenter,
          y: parentPos.y,
        });
      }
    });

    // Hanya proses jika ada minimal 2 parents yang valid
    if (parentPositions.length >= 2) {
      // Sort parents berdasarkan x position (kiri ke kanan)
      parentPositions.sort((a, b) => a.xCenter - b.xCenter);

      // Hitung posisi tengah antara parents (gunakan parent paling kiri dan paling kanan)
      const leftParent = parentPositions[0];
      const rightParent = parentPositions[parentPositions.length - 1];

      // PERBAIKAN: Untuk TCU, pastikan centerX benar-benar di tengah dengan presisi lebih tinggi
      // Gunakan posisi actual dari nodes berdasarkan ID, bukan dari map (untuk memastikan posisi final)
      let leftParentActualX = leftParent.xCenter;
      let rightParentActualX = rightParent.xCenter;

      // Untuk TCU, ambil posisi actual dari nodes berdasarkan ID untuk memastikan akurasi
      if (divisi === "TCU") {
        // Cari node berdasarkan ID parent
        const leftParentNode = nodes.find((n) => {
          // Cek apakah node ID sama dengan parent ID atau mengandung parent ID
          return (
            n.id === leftParent.id ||
            n.id.startsWith(leftParent.id + "|") ||
            n.id.endsWith("|" + leftParent.id) ||
            (n.id.includes("|") && n.id.split("|")[0] === leftParent.id)
          );
        });
        const rightParentNode = nodes.find((n) => {
          return (
            n.id === rightParent.id ||
            n.id.startsWith(rightParent.id + "|") ||
            n.id.endsWith("|" + rightParent.id) ||
            (n.id.includes("|") && n.id.split("|")[0] === rightParent.id)
          );
        });

        if (leftParentNode) {
          leftParentActualX = leftParentNode.position.x + nodeWidth / 2;
        }
        if (rightParentNode) {
          rightParentActualX = rightParentNode.position.x + nodeWidth / 2;
        }
      }

      // PERBAIKAN: Untuk TCU, tempatkan shared subordinate di kanan parent yang paling kanan
      // Agar tidak menutupi parent (WELLY)
      let centerX: number;
      if (divisi === "TCU") {
        // Tempatkan di kanan parent yang paling kanan dengan spacing yang cukup
        // Gunakan rightParentActualX + nodeWidth/2 untuk mendapatkan right edge, lalu tambahkan spacing
        const rightParentRightEdge = rightParentActualX + nodeWidth / 2;
        centerX = rightParentRightEdge + hSpacing + nodeWidth / 2;
      } else {
        // Untuk divisi lain, tetap di tengah
        centerX = (leftParentActualX + rightParentActualX) / 2;
      }

      // Tentukan depth (level) untuk shared subordinate
      // PERBAIKAN: Untuk TCU, tempatkan di level yang sama dengan parent yang paling bawah (maxParentDepth)
      // Jadi sejajar dengan parent (bukan di bawah parent)
      // Untuk divisi lain, gunakan logika normal (depth maksimum + 1)
      const parentDepths = parentPositions.map((p) => {
        return Math.round(p.y / (nodeHeight + vSpacing));
      });
      const maxParentDepth = Math.max(...parentDepths);

      let childDepth: number;
      if (divisi === "TCU") {
        // TCU khusus: Tempatkan di level yang sama dengan parent yang paling bawah
        // Jadi PAMELA akan sejajar dengan WELLY (di bawah TITO, sama level dengan WELLY)
        childDepth = maxParentDepth;
      } else {
        // Divisi lain: tempatkan di level berikutnya
        childDepth = maxParentDepth + 1;
      }
      const childY = childDepth * (nodeHeight + vSpacing);

      // PENTING: Hapus node jika sudah ada (karena shared subordinate tidak boleh ditempatkan sebagai child normal)
      const existingNodeIndex = nodes.findIndex((n) => n.id === childId);
      if (existingNodeIndex >= 0) {
        // Hapus node yang sudah ada dan buat ulang di posisi yang benar
        nodes.splice(existingNodeIndex, 1);
      }

      // Buat node baru di posisi tengah-tengah parents
      nodes.push(
        makeNode(sharedChild, centerX - nodeWidth / 2, childY, direction)
      );

      // Update nodePositionMap
      nodePositionMap.set(childId, {
        x: centerX - nodeWidth / 2,
        y: childY,
        xCenter: centerX,
      });

      // Hapus semua edges yang sudah ada untuk shared subordinate (jika ada)
      // Kita akan membuat edges baru dari semua parents
      const edgesToRemove: number[] = [];
      edges.forEach((edge, idx) => {
        if (edge.target === childId) {
          edgesToRemove.push(idx);
        }
      });
      // Remove dari belakang agar index tidak bergeser
      edgesToRemove.reverse().forEach((idx) => edges.splice(idx, 1));

      // Buat edges dari semua parents ke shared subordinate
      // PERBAIKAN: Untuk TCU dengan 2 parents, edge routing khusus:
      // - Parent kiri (TITO): dari kanan TITO ke kanan PAMELA (right-source ke right)
      // - Parent kanan (WELLY): dari kiri WELLY ke kiri PAMELA (left-source ke left)
      parentPositions.forEach((parent, idx) => {
        let sourceHandle: string;
        let targetHandle: string;

        if (divisi === "TCU" && parentPositions.length === 2) {
          // TCU khusus untuk 2 parents:
          // Parent kiri (idx 0): dari kanan parent ke kanan child
          // Parent kanan (idx 1): dari kiri parent ke kiri child
          if (idx === 0) {
            // Parent kiri (TITO): dari kanan ke kanan
            sourceHandle = "right-source";
            targetHandle = "right";
          } else {
            // Parent kanan (WELLY): dari kiri ke kiri
            sourceHandle = "left-source";
            targetHandle = "left";
          }
        } else {
          // Logika normal untuk divisi lain atau lebih dari 2 parents
          const isRightmostParent = idx === parentPositions.length - 1;
          sourceHandle = isRightmostParent ? "right-source" : "left-source";
          targetHandle = isRightmostParent ? "right" : "left";
        }

        edges.push(
          makeEdge(parent.id, childId, direction, sourceHandle, targetHandle)
        );
      });
    }
  });

  // If direction is LR, swap x/y to lay out left-to-right
  if (direction === "LR") {
    nodes.forEach((n) => {
      const x = n.position.x;
      const y = n.position.y;
      n.position = { x: y, y: x };
      n.sourcePosition = Position.Right;
      n.targetPosition = Position.Left;
    });
  }

  return { nodes, edges };
}

function makeNode(
  item: OrgItem,
  x: number,
  y: number,
  direction: "TB" | "LR"
): Node {
  const badge = item.badgeColor || "#1E40AF";
  const isVacant =
    !item.label || item.label.trim() === "" || item.label === "-";

  return {
    id: item.id,
    position: { x, y },
    data: {
      label: (
        <div
          className={`rounded-2xl border-2 w-[240px] max-w-[240px] transition-all duration-200 group overflow-hidden relative border-gray-200 bg-white hover:border-blue-300`}
          style={{ boxShadow: "none" }}
        >
          {/* Badge VACANT di pojok kanan atas */}
          {isVacant && (
            <div className="absolute top-2 right-2 z-10">
              <div
                className="px-2 py-1 bg-white text-black text-xs font-bold rounded-full flex items-center gap-1 border border-gray-300"
                style={{ boxShadow: "none" }}
              >
                <svg
                  width="12"
                  height="12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="text-black"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                VACANT
              </div>
            </div>
          )}

          {/* Custom handles untuk side entry (left dan right) */}
          <Handle
            type="target"
            position={Position.Left}
            id="left"
            style={{
              left: 0,
              top: "50%",
              transform: "translateY(-50%)",
              width: 0,
              height: 0,
              opacity: 0,
              background: "transparent",
              border: "none",
            }}
          />
          <Handle
            type="target"
            position={Position.Right}
            id="right"
            style={{
              right: 0,
              top: "50%",
              transform: "translateY(-50%)",
              width: 0,
              height: 0,
              opacity: 0,
              background: "transparent",
              border: "none",
            }}
          />
          <Handle
            type="source"
            position={Position.Left}
            id="left-source"
            style={{
              left: 0,
              top: "50%",
              transform: "translateY(-50%)",
              width: 0,
              height: 0,
              opacity: 0,
              background: "transparent",
              border: "none",
            }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="right-source"
            style={{
              right: 0,
              top: "50%",
              transform: "translateY(-50%)",
              width: 0,
              height: 0,
              opacity: 0,
              background: "transparent",
              border: "none",
            }}
          />
          <div className="p-4">
            {/* Foto di tengah dengan NIP di samping kanan */}
            <div className="flex justify-center items-center gap-3 mb-4">
              <ProfilePhoto photoUrl={item.photoUrl} label={item.label} />
              {item.nipp && (
                <p className="text-xl font-bold text-gray-900">{item.nipp}</p>
              )}
            </div>

            {/* Informasi lainnya di bawah foto, rata kiri */}
            <div className="text-left space-y-2">
              {item.label && (
                <div className="text-2xl font-bold text-gray-900 break-words">
                  {item.label || "-"}
                </div>
              )}
              <div className="text-lg font-bold text-gray-700">
                {item.positionTitle || item.subtitle || "-"}
              </div>
              {item.no_hp && item.no_hp.trim() !== "" && (
                <div className="text-base text-gray-600 font-bold flex items-center gap-1.5">
                  <svg
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="flex-shrink-0 text-gray-500"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                    />
                  </svg>
                  <span className="break-all text-gray-700 font-bold">
                    {item.no_hp}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Status Bar */}
          <div
            className="h-1.5 w-full rounded-b-2xl transition-all"
            style={{
              backgroundColor: badge,
              opacity: 0.7,
            }}
          />
        </div>
      ),
    },
    draggable: false,
    selectable: true,
    sourcePosition: direction === "TB" ? Position.Bottom : Position.Right,
    targetPosition: direction === "TB" ? Position.Top : Position.Left,
    type: "default",
  } as Node;
}

function makeEdge(
  source: string,
  target: string,
  direction: "TB" | "LR",
  sourceHandle?: string,
  targetHandle?: string
): Edge {
  const edge: Edge = {
    id: `${source}-${target}`,
    source,
    target,
    type: "step", // Orthogonal routing (siku-siku)
    animated: false,
    style: {
      strokeWidth: 3, // Tebalkan garis edge
      stroke: "#374151", // Warna abu-abu gelap
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 25,
      height: 25,
      color: "#374151",
    },
  };

  if (sourceHandle) {
    edge.sourceHandle = sourceHandle;
  }
  if (targetHandle) {
    edge.targetHandle = targetHandle;
  }

  return edge;
}

// Wrapper component with ReactFlowProvider
const OrgChart = forwardRef<OrgChartRef, OrgChartProps>((props, ref) => {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by only rendering after mount
  if (!mounted) {
    return (
      <div className="h-[70vh] w-full bg-white flex items-center justify-center">
        <div className="text-gray-500">Memuat struktur organisasi...</div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <OrgChartInternal {...props} ref={ref} />
    </ReactFlowProvider>
  );
});

OrgChart.displayName = "OrgChart";

export default OrgChart;
