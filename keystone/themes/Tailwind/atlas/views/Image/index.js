import { FieldContainer } from "../../components/FieldContainer";
import { FieldLabel } from "../../components/FieldLabel";
import { validateImage, ImageWrapper } from "./Field";

export { Field } from "./Field";

export const Cell = ({ item, field }) => {
  const data = item[field.path];
  if (!data) return null;
  return (
    <div>
      <img
        className="w-36 h-36 rounded-sm"
        alt={data.filename}
        src={data.url}
      />
    </div>
  );
};

export const CardValue = ({ item, field }) => {
  const data = item[field.path];
  return (
    <FieldContainer>
      <FieldLabel>{field.label}</FieldLabel>
      {data && (
        <ImageWrapper>
          <img alt={data.filename} src={data.url} />
        </ImageWrapper>
      )}
    </FieldContainer>
  );
};

export const controller = (config) => {
  return {
    path: config.path,
    label: config.label,
    description: config.description,
    graphqlSelection: `${config.path} {
        url
        id
        extension
        width
        height
        filesize
      }`,
    defaultValue: { kind: "empty" },
    deserialize(item) {
      const value = item[config.path];
      if (!value) return { kind: "empty" };
      return {
        kind: "from-server",
        data: {
          src: value.url,
          id: value.id,
          extension: value.extension,
          ref: value.ref,
          width: value.width,
          height: value.height,
          filesize: value.filesize,
        },
      };
    },
    validate(value) {
      return value.kind !== "upload" || validateImage(value.data) === undefined;
    },
    serialize(value) {
      if (value.kind === "upload") {
        return { [config.path]: { upload: value.data.file } };
      }

      if (value.kind === "remove") {
        return { [config.path]: null };
      }
      return {};
    },
  };
};
