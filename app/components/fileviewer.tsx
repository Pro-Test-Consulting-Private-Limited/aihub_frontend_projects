/* eslint-disable @typescript-eslint/no-explicit-any */
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactMarkdown from "react-markdown";

const CodeViewer = ({ language, content }: any) => {
  return (
    <SyntaxHighlighter
      language={language}
      style={oneLight}
      showLineNumbers
      wrapLongLines
    >
      {content}
    </SyntaxHighlighter>
  );
};

const MarkdownViewer = ({ content }: any) => {
  return (
    <div className="prose max-w-none">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
};

const PlainViewer = ({ content }: any) => (
  <pre className="whitespace-pre-wrap text-sm">{content}</pre>
);

const TextViewer = ({ content }: { content: string }) => {
  return (
    <div className="h-full overflow-auto bg-[#0f172a] text-[#e5e7eb] rounded-md">
      <pre
        className="
          text-sm
          font-mono
          whitespace-pre
          min-w-max
        "
      >
        {content}
      </pre>
    </div>
  );
};

const JsonViewer = ({ content }: { content: string }) => {
  try {
    const formatted = JSON.stringify(JSON.parse(content), null, 2);
    return <CodeViewer language="json" content={formatted} />;
  } catch {
    return <TextViewer content={content} />;
  }
};

const getExtension = (path: string) => path.split(".").pop()?.toLowerCase();

const FileViewer = ({
  filePath,
  content,
}: {
  filePath: string;
  content: string;
}) => {
  const ext = getExtension(filePath);

  switch (ext) {
    case "json":
      return <JsonViewer content={content} />;

    case "yml":
    case "yaml":
      return <CodeViewer language="yaml" content={content} />;

    case "java":
    case "js":
    case "ts":
    case "tsx":
    case "properties":
    case "env":
      return <CodeViewer language={ext} content={content} />;

    case "md":
      return <MarkdownViewer content={content} />;

    case "txt":
    case "log":
    case "csv":
      return <TextViewer content={content} />;

    default:
      return <PlainViewer content={content} />;
  }
};

export default FileViewer;
