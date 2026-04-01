"use client";

import { useMemo } from "react";
import SectionItem from "@/components/SectionItem";

function sortByOrder(a, b) {
  return Number(a.order || 0) - Number(b.order || 0);
}

export default function SectionsTree({
  sections,
  selectedSectionId,
  cursorUsersBySection,
  onSelect,
  onAddRoot,
  onAddChild,
  onDelete,
  onMove,
  disabled,
  loading
}) {
  const roots = useMemo(() => {
    const list = Array.isArray(sections) ? sections : [];
    return list.filter((section) => section.parentId === null).sort(sortByOrder);
  }, [sections]);

  const childrenByRoot = useMemo(() => {
    const list = Array.isArray(sections) ? sections : [];
    const grouped = new Map();

    list.forEach((section) => {
      if (!section.parentId) {
        return;
      }

      const key = String(section.parentId);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(section);
    });

    grouped.forEach((items, key) => {
      grouped.set(key, items.sort(sortByOrder));
    });

    return grouped;
  }, [sections]);

  return (
    <section className="sections-tree">
      <div className="sections-header">
        <h2>Sections</h2>
        <button type="button" onClick={onAddRoot} disabled={disabled}>
          New section
        </button>
      </div>

      {loading ? <p className="list-meta">Loading sections...</p> : null}
      {!loading && roots.length === 0 ? (
        <p className="list-meta">Select a document to load sections.</p>
      ) : null}

      <div className="section-tree-list">
        {roots.map((root, rootIndex) => {
          const children = childrenByRoot.get(String(root.id)) || [];

          return (
            <div key={root.id} className="tree-root-group">
              <SectionItem
                section={root}
                depth={0}
                selectedSectionId={selectedSectionId}
                cursorUsers={cursorUsersBySection?.[String(root.id)] || []}
                onSelect={onSelect}
                onAddChild={onAddChild}
                onDelete={onDelete}
                onMove={onMove}
                siblingCount={roots.length}
                siblingIndex={rootIndex}
                disabled={disabled}
              />

              {children.length > 0 ? (
                <div className="tree-child-group">
                  {children.map((child, childIndex) => (
                    <SectionItem
                      key={child.id}
                      section={child}
                      depth={1}
                      selectedSectionId={selectedSectionId}
                      cursorUsers={cursorUsersBySection?.[String(child.id)] || []}
                      onSelect={onSelect}
                      onAddChild={onAddChild}
                      onDelete={onDelete}
                      onMove={onMove}
                      siblingCount={children.length}
                      siblingIndex={childIndex}
                      disabled={disabled}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
