import React from "react";
import type { ModalProps } from "@mantine/core";
import { Modal, Stack, Text, ScrollArea, Flex, CloseButton, Button, TextInput } from "@mantine/core";
import { CodeHighlight } from "@mantine/code-highlight";
import toast from "react-hot-toast";
import type { NodeData, NodeRow } from "../../../types/graph";
import useGraph from "../../editor/views/GraphView/stores/useGraph";
import useJson from "../../../store/useJson";
import useFile from "../../../store/useFile";
import type { JSONPath } from "jsonc-parser";

// return object from json removing array and object fields
const normalizeNodeData = (nodeRows: NodeData["text"]) => {
  if (!nodeRows || nodeRows.length === 0) return "{}";
  if (nodeRows.length === 1 && !nodeRows[0].key) return `${nodeRows[0].value}`;

  const obj = {};
  nodeRows?.forEach(row => {
    if (row.type !== "array" && row.type !== "object") {
      if (row.key) obj[row.key] = row.value;
    }
  });
  return JSON.stringify(obj, null, 2);
};

// return json path in the format $["customer"]
const jsonPathToString = (path?: NodeData["path"]) => {
  if (!path || path.length === 0) return "$";
  const segments = path.map(seg => (typeof seg === "number" ? seg : `"${seg}"`));
  return `$[${segments.join("][")}]`;
};

// Update JSON at the specified path with new values
const updateJsonAtPath = (json: string, path: JSONPath | undefined, updates: Record<string, any>): string => {
  try {
    const parsed = JSON.parse(json);
    
    if (!path || path.length === 0) {
      // Root level - update directly
      return JSON.stringify({ ...parsed, ...updates }, null, 2);
    }

    // Navigate to the target object using the path
    let current = parsed;
    for (let i = 0; i < path.length; i++) {
      current = current[path[i]];
    }

    // Update the target object
    Object.assign(current, updates);

    return JSON.stringify(parsed, null, 2);
  } catch (error) {
    throw new Error("Failed to update JSON");
  }
};

export const NodeModal = ({ opened, onClose }: ModalProps) => {
  const nodeData = useGraph(state => state.selectedNode);
  const getJson = useJson(state => state.getJson);
  const setJson = useJson(state => state.setJson);
  const setFileContents = useFile(state => state.setContents);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedData, setEditedData] = React.useState<Record<string, any>>({});

  React.useEffect(() => {
    if (opened && nodeData) {
      // Initialize edited data from node data
      const initialData: Record<string, any> = {};
      nodeData.text?.forEach(row => {
        if (row.type !== "array" && row.type !== "object" && row.key) {
          initialData[row.key] = row.value;
        }
      });
      setEditedData(initialData);
      setIsEditing(false);
    }
  }, [opened, nodeData]);

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = () => {
    try {
      const currentJson = getJson();
      const updatedJson = updateJsonAtPath(currentJson, nodeData?.path, editedData);
      setIsEditing(false);
      // Update file contents which will trigger graph refresh
      setFileContents({ contents: updatedJson, hasChanges: true });
      toast.success("Changes saved successfully");
      onClose();
    } catch (error) {
      toast.error("Failed to save changes");
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset edited data
    const resetData: Record<string, any> = {};
    nodeData?.text?.forEach(row => {
      if (row.type !== "array" && row.type !== "object" && row.key) {
        resetData[row.key] = row.value;
      }
    });
    setEditedData(resetData);
  };

  const handleFieldChange = (key: string, value: any) => {
    setEditedData(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const editableFields = nodeData?.text?.filter(row => row.type !== "array" && row.type !== "object" && row.key) ?? [];

  return (
    <Modal size="auto" opened={opened} onClose={onClose} centered withCloseButton={false}>
      <Stack pb="sm" gap="sm">
        <Stack gap="xs">
          <Flex justify="space-between" align="center">
            <Text fz="xs" fw={500}>
              Content
            </Text>
            <Flex gap="xs" align="center">
              {!isEditing && (
                <Button size="xs" onClick={handleEdit}>
                  Edit
                </Button>
              )}
              {isEditing && (
                <>
                  <Button size="xs" color="green" onClick={handleSave}>
                    Save
                  </Button>
                  <Button size="xs" color="red" onClick={handleCancel}>
                    Cancel
                  </Button>
                </>
              )}
              <CloseButton onClick={onClose} />
            </Flex>
          </Flex>

          {isEditing ? (
            <Stack gap="sm" mah={400} style={{ overflowY: "auto" }}>
              {editableFields.map((field, index) => (
                <div key={index}>
                  <Text fz="xs" fw={500} mb={4}>
                    {field.key}
                  </Text>
                  <TextInput
                    value={editedData[field.key!] ?? ""}
                    onChange={e => handleFieldChange(field.key!, e.currentTarget.value)}
                    placeholder={`Enter ${field.key}`}
                    size="sm"
                  />
                </div>
              ))}
            </Stack>
          ) : (
            <ScrollArea.Autosize mah={250} maw={600}>
              <CodeHighlight
                code={normalizeNodeData(nodeData?.text ?? [])}
                miw={350}
                maw={600}
                language="json"
                withCopyButton
              />
            </ScrollArea.Autosize>
          )}
        </Stack>

        <Text fz="xs" fw={500}>
          JSON Path
        </Text>
        <ScrollArea.Autosize maw={600}>
          <CodeHighlight
            code={jsonPathToString(nodeData?.path)}
            miw={350}
            mah={250}
            language="json"
            copyLabel="Copy to clipboard"
            copiedLabel="Copied to clipboard"
            withCopyButton
          />
        </ScrollArea.Autosize>
      </Stack>
    </Modal>
  );
};
