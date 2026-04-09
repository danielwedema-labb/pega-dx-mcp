import { case_info_t, resources_t } from "./dx_api_model_types.js";
// Used to indicate what information is available for display.
export var app_status_t;
(function (app_status_t) {
    app_status_t[app_status_t["logged_out"] = 0] = "logged_out";
    app_status_t[app_status_t["logged_in"] = 1] = "logged_in";
    app_status_t[app_status_t["open_case"] = 2] = "open_case";
    app_status_t[app_status_t["open_assignment"] = 3] = "open_assignment";
    app_status_t[app_status_t["open_action"] = 4] = "open_action";
})(app_status_t || (app_status_t = {}));
;
// Application state.
export class app_context_t {
    // Display data. //////////////////
    status = app_status_t.logged_out;
    show_debug_window = true;
    show_demo_window = false;
    font_index = -1;
    // General data. //////////////////
    access_token;
    flash; // Messages (usually errors) that should be highlighted to the user: string.
    endpoint;
    request_headers;
    request_body;
    response_headers;
    response_body;
    server = '';
    dx_api_path = '/prweb/api/application/v2';
    oauth2 = {
        authorization_endpoint: '',
        token_endpoint: '',
        user_id: '',
        password: '',
        client_id: '',
        client_secret: '',
        grant_type: '',
        auth_service: 'pega',
        app_alias: '',
        no_pkce: '',
        redirect_uri: '/dist/authDone.html'
    };
    component_debug_json = "Click a component to display its JSON.\nThe format is:\n  Type: Name [Info]\n\nInfo varies by component:\n- Reference [Target Type]\n- View [Template]";
    field_debug_json = "Click a field to display its JSON.";
    // DX API response data. //////////
    case_types = new Array();
    case_info = new case_info_t();
    resources = new resources_t();
    next_assignment_id;
    open_assignment_id;
    open_action_id;
    root_component_key;
    etag; // https://docs.pega.com/bundle/dx-api/page/platform/dx-api/building-constellation-dx-api-request.html
    // Threading data. ////////////////
    dx_request_mutex; //std::mutex
    dx_response_queue; //net_call_queue_t
    dx_response_mutex; //std::mutex
    shutdown_requested = false;
    action_buttons;
    constructor() {
        this.shutdown_requested = false;
    }
}
;
