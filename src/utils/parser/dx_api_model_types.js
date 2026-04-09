// https://docs.pega.com/bundle/dx-api/page/platform/dx-api/understand-dx-api-response.html#d33668e1783
export class field_t {
    id;
    class_id;
    page_class;
    label;
    type;
    data;
    json;
    is_special = false;
    is_class_key = false;
    is_dirty = false;
}
;
// Types of components: https://docs.pega.com/bundle/constellation-sdk/page/constellation-sdks/sdks/using-dx-component-builder.html#d15866e82
export var component_type_t;
(function (component_type_t) {
    component_type_t[component_type_t["component_type_unspecified"] = 0] = "component_type_unspecified";
    component_type_t[component_type_t["component_type_unknown"] = 1] = "component_type_unknown";
    // ...always first.
    // Design system extensions:
    // ...nothing yet!
    // Infrastructure:
    component_type_t[component_type_t["component_type_reference"] = 2] = "component_type_reference";
    component_type_t[component_type_t["component_type_region"] = 3] = "component_type_region";
    component_type_t[component_type_t["component_type_view"] = 4] = "component_type_view";
    component_type_t[component_type_t["component_type_group"] = 5] = "component_type_group";
    component_type_t[component_type_t["component_type_flow_container"] = 6] = "component_type_flow_container";
    // Fields:
    component_type_t[component_type_t["component_type_text_area"] = 7] = "component_type_text_area";
    component_type_t[component_type_t["component_type_text_input"] = 8] = "component_type_text_input";
    component_type_t[component_type_t["component_type_integer"] = 9] = "component_type_integer";
    component_type_t[component_type_t["component_type_currency"] = 10] = "component_type_currency";
    component_type_t[component_type_t["component_type_decimal"] = 11] = "component_type_decimal";
    component_type_t[component_type_t["component_type_email"] = 12] = "component_type_email";
    component_type_t[component_type_t["component_type_phone"] = 13] = "component_type_phone";
    component_type_t[component_type_t["component_type_checkbox"] = 14] = "component_type_checkbox";
    component_type_t[component_type_t["component_type_date"] = 15] = "component_type_date";
    component_type_t[component_type_t["component_type_dropdown"] = 16] = "component_type_dropdown";
    component_type_t[component_type_t["component_type_radio"] = 17] = "component_type_radio";
    component_type_t[component_type_t["component_type_url"] = 18] = "component_type_url";
    // Templates:
    component_type_t[component_type_t["component_type_default_form"] = 19] = "component_type_default_form";
    // Widgets:
    component_type_t[component_type_t["component_type_attachment"] = 20] = "component_type_attachment";
    // Always last:
    component_type_t[component_type_t["component_type_count"] = 21] = "component_type_count";
})(component_type_t || (component_type_t = {}));
;
// Component strings as we'll see them in DX API responses, should be in same order as enum.
export const component_type_strings = [
    "Unspecified",
    "Unknown",
    "Reference",
    "Region",
    "View",
    "Group",
    "FlowContainer",
    "TextArea",
    "TextInput",
    "Integer",
    "Currency",
    "Decimal",
    "Email",
    "Phone",
    "Checkbox",
    "Date",
    "Dropdown",
    "RadioButtons",
    "URL",
    "DefaultForm",
    "Attachment",
];
// Component megastruct:
export class component_t {
    type = component_type_t.component_type_unspecified;
    name;
    class_id;
    key; // Identifies this rule, or the referenced rule in the case of references/fields:string.
    // ...required for all components!
    label;
    json;
    debug_string;
    broken_string;
    is_readonly = false;
    is_required = false;
    is_disabled = false;
    is_broken = false;
    is_selected = false;
    ref_type = component_type_t.component_type_unspecified; // Referenced component / type of template.
    children = new Array();
    instructions;
    options;
}
;
// https://docs.pega.com/bundle/dx-api/page/platform/dx-api/understand-dx-api-response.html#d33668e2455
export class action_t {
    id;
    name;
    type;
}
;
// https://docs.pega.com/bundle/dx-api/page/platform/dx-api/understand-dx-api-response.html#d33668e1053
export class assignment_t {
    id;
    name;
    can_perform = false;
    actions = new Map();
}
;
// https://docs.pega.com/bundle/dx-api/page/platform/dx-api/endpoint-get-casetypes.html
export class case_type_t {
    id;
    name;
}
;
// https://docs.pega.com/bundle/dx-api/page/platform/dx-api/understand-dx-api-response.html#d33668e350
export class case_info_t {
    type = new case_type_t();
    id;
    business_id;
    create_time;
    created_by;
    last_update_time;
    last_updated_by;
    name;
    owner;
    status;
    assignments = new Map();
    content = new Map();
}
;
export class paragraph_t {
    content;
    name;
    classID;
}
// https://docs.pega.com/bundle/dx-api/page/platform/dx-api/understand-dx-api-response.html#d33668e1783
export class resources_t {
    paragraphs = new Map();
    fields = new Map();
    components = new Map();
}
;
