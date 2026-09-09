/* eslint-disable @typescript-eslint/no-explicit-any */
import JavaIcon from "../../public/icons/files/java.svg";
import JsIcon from "../../public/icons/files/javascript.svg";
import TsIcon from "../../public/icons/files/typescript.svg";
import ReactIcon from "../../public/icons/files/react.svg";
import JsonIcon from "../../public/icons/files/json.svg";
import YamlIcon from "../../public/icons/files/yaml.svg";
import MarkdownIcon from "../../public/icons/files/markdown.svg";
import EnvIcon from "../../public/icons/files/env.svg";
import FileIcon from "../../public/icons/files/file.svg";

export const getFileIcon = (file: any) => {
  const ext = file.name?.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    java: JavaIcon,
    js: JsIcon,
    ts: TsIcon,
    tsx: ReactIcon,
    json: JsonIcon,
    yml: YamlIcon,
    yaml: YamlIcon,
    md: MarkdownIcon,
    env: EnvIcon,
  };
  return map[ext || ""] || FileIcon;
};
