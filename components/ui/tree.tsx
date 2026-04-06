"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  File01Icon,
  Folder01Icon,
  Folder02Icon,
} from "@hugeicons/core-free-icons"
import { AnimatePresence, motion } from "motion/react"
import {
  type ComponentProps,
  createContext,
  type HTMLAttributes,
  type ReactNode,
  useCallback,
  useContext,
  useId,
  useState,
} from "react"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/loader"

type TreeContextType = {
  expandedIds: Set<string>
  selectedIds: string[]
  toggleExpanded: (nodeId: string) => void
  handleSelection: (nodeId: string, ctrlKey: boolean) => void
  showLines?: boolean
  showIcons?: boolean
  selectable?: boolean
  multiSelect?: boolean
  indent?: number
  animateExpand?: boolean
}

const TreeContext = createContext<TreeContextType | undefined>(undefined)

const useTree = () => {
  const context = useContext(TreeContext)
  if (!context) {
    throw new Error("Tree components must be used within a TreeProvider")
  }
  return context
}

type TreeNodeContextType = {
  nodeId: string
  level: number
  isLast: boolean
  parentPath: boolean[]
}

const TreeNodeContext = createContext<TreeNodeContextType | undefined>(
  undefined
)

const useTreeNode = () => {
  const context = useContext(TreeNodeContext)
  if (!context) {
    throw new Error("TreeNode components must be used within a TreeNode")
  }
  return context
}

export type TreeProviderProps = {
  children: ReactNode
  defaultExpandedIds?: string[]
  showLines?: boolean
  showIcons?: boolean
  selectable?: boolean
  multiSelect?: boolean
  selectedIds?: string[]
  onSelectionChangeAction?: (selectedIds: string[]) => void
  indent?: number
  animateExpand?: boolean
  className?: string
}

export const TreeProvider = ({
  children,
  defaultExpandedIds = [],
  showLines = true,
  showIcons = true,
  selectable = true,
  multiSelect = false,
  selectedIds,
  onSelectionChangeAction,
  indent = 20,
  animateExpand = true,
  className,
}: TreeProviderProps) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(defaultExpandedIds)
  )
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>(
    selectedIds ?? []
  )

  const isControlled =
    selectedIds !== undefined && onSelectionChangeAction !== undefined
  const currentSelectedIds = isControlled ? selectedIds : internalSelectedIds

  const toggleExpanded = useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId)
      } else {
        newSet.add(nodeId)
      }
      return newSet
    })
  }, [])

  const handleSelection = useCallback(
    (nodeId: string, ctrlKey = false) => {
      if (!selectable) {
        return
      }

      let newSelection: string[]

      if (multiSelect && ctrlKey) {
        newSelection = currentSelectedIds.includes(nodeId)
          ? currentSelectedIds.filter((id) => id !== nodeId)
          : [...currentSelectedIds, nodeId]
      } else {
        newSelection = currentSelectedIds.includes(nodeId) ? [] : [nodeId]
      }

      if (isControlled) {
        onSelectionChangeAction?.(newSelection)
      } else {
        setInternalSelectedIds(newSelection)
      }
    },
    [
      selectable,
      multiSelect,
      currentSelectedIds,
      isControlled,
      onSelectionChangeAction,
    ]
  )

  return (
    <TreeContext.Provider
      value={{
        expandedIds,
        selectedIds: currentSelectedIds,
        toggleExpanded,
        handleSelection,
        showLines,
        showIcons,
        selectable,
        multiSelect,
        indent,
        animateExpand,
      }}
    >
      <div className={cn("w-full", className)}>{children}</div>
    </TreeContext.Provider>
  )
}

export type TreeViewProps = HTMLAttributes<HTMLDivElement>

export const TreeView = ({ className, children, ...props }: TreeViewProps) => (
  <div className={cn("p-2", className)} {...props}>
    {children}
  </div>
)

export type TreeNodeProps = Omit<HTMLAttributes<HTMLDivElement>, "onClick"> & {
  nodeId?: string
  level?: number
  isLast?: boolean
  parentPath?: boolean[]
  children?: ReactNode
}

export const TreeNode = ({
  nodeId: providedNodeId,
  level = 0,
  isLast = false,
  parentPath = [],
  children,
  className,
  ...props
}: TreeNodeProps) => {
  const generatedId = useId()
  const nodeId = providedNodeId ?? generatedId

  const currentPath = level === 0 ? [] : [...parentPath]
  if (level > 0 && parentPath.length < level - 1) {
    while (currentPath.length < level - 1) {
      currentPath.push(false)
    }
  }
  if (level > 0) {
    currentPath[level - 1] = isLast
  }

  return (
    <TreeNodeContext.Provider
      value={{
        nodeId,
        level,
        isLast,
        parentPath: currentPath,
      }}
    >
      <div className={cn("select-none", className)} {...props}>
        {children}
      </div>
    </TreeNodeContext.Provider>
  )
}

export type TreeNodeTriggerProps = ComponentProps<typeof motion.div> & {
  /** When true, suppresses automatic toggleExpanded — caller controls open state */
  controlled?: boolean
}

export const TreeNodeTrigger = ({
  children,
  className,
  onClick,
  controlled = false,
  ...props
}: TreeNodeTriggerProps) => {
  const { selectedIds, toggleExpanded, handleSelection, indent } = useTree()
  const { nodeId, level } = useTreeNode()
  const isSelected = selectedIds.includes(nodeId)

  return (
    <motion.div
      className={cn(
        "group relative mx-1 flex cursor-pointer items-center rounded-md px-3 py-2 transition-all duration-200",
        "hover:bg-accent/50",
        isSelected && "bg-accent/80",
        className
      )}
      onClick={(e) => {
        if (!controlled) toggleExpanded(nodeId)
        handleSelection(nodeId, e.ctrlKey || e.metaKey)
        onClick?.(e)
      }}
      style={{ paddingLeft: level * (indent ?? 0) + 8 }}
      whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
      {...props}
    >
      <TreeLines />
      {children as ReactNode}
    </motion.div>
  )
}

export const TreeLines = () => {
  const { showLines, indent } = useTree()
  const { level, isLast, parentPath } = useTreeNode()

  if (!showLines || level === 0) {
    return null
  }

  return (
    <div className="pointer-events-none absolute top-0 bottom-0 left-0">
      {Array.from({ length: level }, (_, index) => {
        const shouldHideLine = parentPath[index] === true
        if (shouldHideLine && index === level - 1) {
          return null
        }

        return (
          <div
            className="absolute top-0 bottom-0 border-l border-border/40"
            key={index.toString()}
            style={{
              left: index * (indent ?? 0) + 12,
              display: shouldHideLine ? "none" : "block",
            }}
          />
        )
      })}

      <div
        className="absolute top-1/2 border-t border-border/40"
        style={{
          left: (level - 1) * (indent ?? 0) + 12,
          width: (indent ?? 0) - 4,
          transform: "translateY(-1px)",
        }}
      />

      {isLast && (
        <div
          className="absolute top-0 border-l border-border/40"
          style={{
            left: (level - 1) * (indent ?? 0) + 12,
            height: "50%",
          }}
        />
      )}
    </div>
  )
}

export type TreeNodeContentProps = ComponentProps<typeof motion.div> & {
  hasChildren?: boolean
  /** Override context-driven expand state (e.g. when parent manages open) */
  isOpen?: boolean
}

export const TreeNodeContent = ({
  children,
  hasChildren = true,
  isOpen,
  className,
  ...props
}: TreeNodeContentProps) => {
  const { animateExpand, expandedIds } = useTree()
  const { nodeId } = useTreeNode()
  const isExpanded = isOpen ?? expandedIds.has(nodeId)

  return (
    <AnimatePresence>
      {hasChildren && isExpanded && (
        <motion.div
          animate={{ height: "auto", opacity: 1 }}
          className="overflow-hidden"
          exit={{ height: 0, opacity: 0 }}
          initial={{ height: 0, opacity: 0 }}
          transition={{
            duration: animateExpand ? 0.3 : 0,
            ease: "easeInOut",
          }}
        >
          <motion.div
            animate={{ y: 0 }}
            className={className}
            exit={{ y: -10 }}
            initial={{ y: -10 }}
            transition={{
              duration: animateExpand ? 0.2 : 0,
              delay: animateExpand ? 0.1 : 0,
            }}
            {...props}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export type TreeExpanderProps = ComponentProps<typeof motion.div> & {
  hasChildren?: boolean
  /** Override context-driven open state */
  isOpen?: boolean
  isPending?: boolean
}

export const TreeExpander = ({
  hasChildren = false,
  isOpen,
  isPending = false,
  className,
  onClick,
  ...props
}: TreeExpanderProps) => {
  const { expandedIds, toggleExpanded } = useTree()
  const { nodeId } = useTreeNode()
  const isExpanded = isOpen ?? expandedIds.has(nodeId)

  if (!hasChildren) {
    return <div className="mr-1 h-4 w-4" />
  }

  return (
    <motion.div
      animate={{ rotate: isPending ? 0 : isExpanded ? 90 : 0 }}
      className={cn(
        "mr-1 flex h-4 w-4 cursor-pointer items-center justify-center",
        className
      )}
      onClick={(e) => {
        e.stopPropagation()
        if (!isOpen) toggleExpanded(nodeId)
        onClick?.(e)
      }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      {...props}
    >
      {isPending ? (
        <Spinner size={10} />
      ) : (
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          size={12}
          className="text-muted-foreground"
        />
      )}
    </motion.div>
  )
}

export type TreeIconProps = ComponentProps<typeof motion.div> & {
  icon?: ReactNode
  hasChildren?: boolean
  /** Override context-driven open state */
  isOpen?: boolean
}

export const TreeIcon = ({
  icon,
  hasChildren = false,
  isOpen,
  className,
  ...props
}: TreeIconProps) => {
  const { showIcons, expandedIds } = useTree()
  const { nodeId } = useTreeNode()
  const isExpanded = isOpen ?? expandedIds.has(nodeId)

  if (!showIcons) {
    return null
  }

  const getDefaultIcon = () => {
    if (!hasChildren) return <HugeiconsIcon icon={File01Icon} size={16} />
    return isExpanded ? (
      <HugeiconsIcon icon={Folder02Icon} size={16} />
    ) : (
      <HugeiconsIcon icon={Folder01Icon} size={16} />
    )
  }

  return (
    <motion.div
      className={cn(
        "mr-2 flex h-4 w-4 items-center justify-center text-muted-foreground",
        className
      )}
      transition={{ duration: 0.15 }}
      whileHover={{ scale: 1.1 }}
      {...props}
    >
      {icon || getDefaultIcon()}
    </motion.div>
  )
}

export type TreeLabelProps = HTMLAttributes<HTMLSpanElement>

export const TreeLabel = ({ className, ...props }: TreeLabelProps) => (
  <span className={cn("flex-1 truncate text-sm", className)} {...props} />
)
