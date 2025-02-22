import { useCallback, useState } from "react";
import { useFieldsObj } from "@keystone/utils/useFieldObj";
import { gql, useMutation } from "@keystone-6/core/admin-ui/apollo";
import {
  deserializeValue,
  useInvalidFields,
  Fields,
  useChangedFieldsAndDataForUpdate,
  makeDataGetter,
} from "@keystone-6/core/admin-ui/utils";
import { Button } from "../../primitives/default/ui/button";
import { useToasts } from "../Toast";
import { GraphQLErrorNotice } from "../GraphQLErrorNotice";

export function InlineEdit({
  fields,
  list,
  selectedFields,
  itemGetter,
  onCancel,
  onSave,
}) {
  const fieldsObj = useFieldsObj(list, fields);

  const [update, { loading, error }] = useMutation(
    gql`mutation ($data: ${list.gqlNames.updateInputName}!, $id: ID!) {
        item: ${list.gqlNames.updateMutationName}(where: { id: $id }, data: $data) {
          ${selectedFields}
        }
      }`,
    { errorPolicy: "all" }
  );

  const [state, setValue] = useState(() => {
    const value = deserializeValue(fieldsObj, itemGetter);
    return { value, item: itemGetter.data };
  });

  if (
    state.item !== itemGetter.data &&
    itemGetter.errors?.every((x) => x.path?.length !== 1)
  ) {
    const value = deserializeValue(fieldsObj, itemGetter);
    setValue({ value, item: itemGetter.data });
  }

  const { changedFields, dataForUpdate } = useChangedFieldsAndDataForUpdate(
    fieldsObj,
    itemGetter,
    state.value
  );

  const invalidFields = useInvalidFields(fieldsObj, state.value);

  const [forceValidation, setForceValidation] = useState(false);
  const toasts = useToasts();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (changedFields.size === 0) {
          onCancel();
          return;
        }
        const newForceValidation = invalidFields.size !== 0;
        setForceValidation(newForceValidation);
        if (newForceValidation) return;

        update({
          variables: {
            data: dataForUpdate,
            id: itemGetter.get("id").data,
          },
        })
          .then(({ data, errors }) => {
            // we're checking for path.length === 1 because errors with a path larger than 1 will be field level errors
            // which are handled seperately and do not indicate a failure to update the item
            const error = errors?.find((x) => x.path?.length === 1);
            if (error) {
              toasts.addToast({
                title: "Failed to update item",
                tone: "negative",
                message: error.message,
              });
            } else {
              toasts.addToast({
                title: data.item[list.labelField] || data.item.id,
                tone: "positive",
                message: "Saved successfully",
              });
              onSave(makeDataGetter(data, errors).get("item"));
            }
          })
          .catch((err) => {
            toasts.addToast({
              title: "Failed to update item",
              tone: "negative",
              message: err.message,
            });
          });
      }}
    >
      <div className="space-y-10">
        {error && (
          <GraphQLErrorNotice
            networkError={error?.networkError}
            // we're checking for path.length === 1 because errors with a path larger than 1 will be field level errors
            // which are handled seperately and do not indicate a failure to update the item
            errors={error?.graphQLErrors.filter((x) => x.path?.length === 1)}
          />
        )}
        <Fields
          fields={fieldsObj}
          forceValidation={forceValidation}
          invalidFields={invalidFields}
          onChange={useCallback(
            (value) => {
              setValue((state) => ({
                item: state.item,
                value: value(state.value),
              }));
            },
            [setValue]
          )}
          value={state.value}
        />
        <div className="flex gap-1 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button isLoading={loading} size="sm" type="submit">
            Save
          </Button>
        </div>
      </div>
    </form>
  );
}
