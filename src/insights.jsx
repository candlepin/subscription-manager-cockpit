/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2019 Red Hat, Inc.
 *
 * Cockpit is free software; you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation; either version 2.1 of the License, or
 * (at your option) any later version.
 *
 * Cockpit is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Cockpit; If not, see <http://www.gnu.org/licenses/>.
 */

import cockpit from "cockpit";
import React from "react";
import moment from "moment";

import { show_modal_dialog } from "cockpit-components-dialog.jsx";
import * as service from "service.js";
import * as PK from "packagekit";

import { ExclamationTriangleIcon, ExternalLinkAltIcon, WarningTriangleIcon } from '@patternfly/react-icons';
import {
    Alert,
    Button,
    DescriptionListDescription, DescriptionListGroup, DescriptionListTerm,
    ExpandableSection,
    Icon,
    Spinner,
    Stack, StackItem,
} from '@patternfly/react-core';

import subscriptionsClient from './subscriptions-client';

const _ = cockpit.gettext;

moment.locale(cockpit.language);

const insights_timer = service.proxy("insights-client.timer", "Timer");
const insights_service = service.proxy("insights-client.service", "Service");

export function detect() {
    return cockpit.script("type insights-client", { err: "ignore" }).then(() => true, () => false);
}

/*
 * Simple helper to get the string representation of the error of
 * cockpit.spawn(), to be used as catch() handler.
 */
function spawn_error_to_string(err, data) {
    // a problem in starting/running the process: get its string representation
    // from cockpit directly
    if (err.problem || err.message) {
        return cockpit.message(err);
    }
    // the process ran correctly, and exited with a non-zero code: get its
    // combined stdout + stderr
    if (data) {
        return data;
    }
    // When err contains only string then return this string
    if (err) {
        return err.toString();
    }

    console.debug(">>>> returning undefined");
}

export function catch_error(err, data, addAlert) {
    let msg = spawn_error_to_string(err, data);
    if (msg) {
        // usually the output of insights-client contains more than a single
        // line; hence, put each line in its own paragraph, so the error message
        // is displayed in the same format of what insights-client outputs
        if (msg.indexOf("\n") > 0) {
            msg = msg.split("\n").map(line => {
                return <p key={line}>{line}</p>;
            });
        }
    } else {
        msg = "Unable to get any error message.";
    }
    subscriptionsClient.setError("error", msg);
    addAlert(_("Error"), "danger", msg);
}

function ensure_installed(update_progress) {
    return detect().then(installed => {
        if (!installed)
            return PK.check_missing_packages([subscriptionsClient.insightsPackage], update_checking_progress(update_progress))
                    .then(data => {
                        if (data.unavailable_names.length > 0)
                            return Promise.reject(cockpit.format(_("The $0 package is not available from any repository."),
                                                                 data.unavailable_names[0]));
                        if (data.remove_names.length > 0)
                            return Promise.reject(cockpit.format(_("The system could not be connected to Insights because installing the $0 package requires the unexpected removal of other packages."),
                                                                 subscriptionsClient.insightsPackage));
                        return PK.install_missing_packages(data, update_install_progress(update_progress));
                    });
        else
            return Promise.resolve();
    });
}

export function register(update_progress) {
    return ensure_installed(update_progress).then(() => {
        const proc = cockpit.spawn(["insights-client", "--register"], { superuser: true, err: "out" });
        if (update_progress)
            update_progress(_("Connecting to Insights"), () => { proc.close() });
        return proc;
    });
}

export function unregister(addAlert) {
    if (insights_timer.enabled) {
        return cockpit.spawn(["insights-client", "--unregister"], { superuser: true, err: "out" })
                .catch((err, data) => catch_error(err, data, addAlert));
    } else {
        return Promise.resolve();
    }
}

// TODO - generalize this to arbitrary number of arguments (when needed)
export function arrfmt(fmt) {
    const args = Array.prototype.slice.call(arguments, 1);

    function replace(part) {
        if (part[0] === "$") {
            return args[parseInt(part.slice(1))];
        } else
            return part;
    }

    return fmt.split(/(\$[0-9]+)/g).map(replace);
}

function left(func) {
    return function (event) {
        if (!event || event.button !== 0)
            return;
        func();
        event.stopPropagation();
    };
}

export const blurb =
    _("Proactively identify and remediate threats to security, performance, availability, and stability with Red Hat Insights \u2014 with predictive analytics, avoid problems and unplanned downtime in your Red Hat environment.");

export const link = (
    <Button variant="link"
        key="link-to-redhat-insights-web-page"
        isInline
        component='a'
        href="https://www.redhat.com/en/technologies/management/insights" target="_blank" rel="noopener noreferrer"
        icon={<ExternalLinkAltIcon />} iconPosition="right"
    >
        Red Hat Insights
    </Button>
);

function install_data_summary(data) {
    if (!data || data.missing_names.length === 0)
        return null;

    let summary;
    if (data.extra_names.length === 0)
        summary = arrfmt(_("The $0 package will be installed."), <strong>{data.missing_names[0]}</strong>);
    else
        summary = arrfmt(cockpit.ngettext("The $0 package and $1 other package will be installed.",
                                          "The $0 package and $1 other packages will be installed.",
                                          data.extra_names.length), <strong>{data.missing_names[0]}</strong>, data.extra_names.length);
    if (data.remove_names.length > 0) {
        summary = [
            { summary },
            <br key="summary-br" />,
            <ExclamationTriangleIcon className="ct-exclamation-triangle" key="summary-warn" />, "\n",
            cockpit.format(cockpit.ngettext("$0 package needs to be removed.",
                                            "$0 packages need to be removed.",
                                            data.remove_names.length),
                           data.remove_names.length)
        ];
    }

    if (data.extra_names.length > 0 || data.remove_names.length > 0) {
        let extra_details = null;
        let remove_details = null;

        if (data.extra_names.length > 0)
            extra_details = (
                <div className="scale-up-ct">
                    {_("Additional packages:")}
                    <ul className="package-list-ct">{data.extra_names.map(id => <li key={id}>{id}</li>)}</ul>
                </div>
            );

        if (data.remove_names.length > 0)
            remove_details = (
                <div className="scale-up-ct">
                    {_("Removals:")}
                    <ul className="package-list">{data.remove_names.map(id => <li key={id}>{id}</li>)}</ul>
                </div>
            );

        summary = [
            <p key="summary-p">{summary}</p>,
            <ExpandableSection key="summary-expand" toggleText={_("Details")}>{extra_details}{remove_details}</ExpandableSection>
        ];
    }

    return summary;
}

function update_checking_progress(update_progress) {
    return p => {
        let pm = null;
        if (p.waiting)
            pm = _("Waiting for other software management operations to finish");
        else
            pm = _("Checking installed software");
        update_progress(pm, p.cancel);
    };
}

function update_install_progress(update_progress) {
    return p => {
        let text = null;
        if (p.waiting) {
            text = _("Waiting for other software management operations to finish");
        } else if (p.package) {
            let fmt;
            if (p.info === PK.Enum.INFO_DOWNLOADING)
                fmt = _("Downloading $0");
            else if (p.info === PK.Enum.INFO_REMOVING)
                fmt = _("Removing $0");
            else
                fmt = _("Installing $0");
            text = arrfmt(fmt, <strong>{p.package}</strong>);
        }
        update_progress(text, p.cancel);
    };
}

function show_connect_dialog() {
    let dialog = null;
    let cancel = null;
    let progress_message = null;
    let error_message = null;
    let checking_install = false;
    let install_data = null;

    function update() {
        const props = {
            title: _("Connect to Red Hat Insights"),
            body: (
                <div className="modal-body">
                    <strong>{arrfmt(_("This system is not connected to $0."), link)}</strong>
                    <p>{blurb}</p>
                    { install_data_summary(install_data) }
                </div>
            )
        };

        const footer = {
            actions: [
                {
                    caption: _("Connect"),
                    style: "primary",
                    clicked: (update_progress) => {
                        return PK.install_missing_packages(install_data, update_install_progress(update_progress)).then(() =>
                            new Promise((resolve, reject) => {
                                register(update_progress)
                                        .then(() => resolve())
                                        .catch((err, data) => {
                                            const msg = spawn_error_to_string(err, data);
                                            // create a fake error object good enough
                                            // to be caught by the catch() handler of
                                            // actions of cockpit.DialogFooter
                                            const new_err = { };
                                            new_err.message = msg;
                                            new_err.toString = function() {
                                                return this.message;
                                            };
                                            reject(new Error(new_err));
                                        });
                            }));
                    },
                    disabled: checking_install,
                }
            ],
            idle_message: progress_message && <div><Spinner className="dialog-wait-ct-spinner" size="md" /><span>{ progress_message }</span></div>,
            static_error: error_message,
            dialog_done: f => { if (!f && cancel) cancel(); }
        };

        if (dialog) {
            dialog.setProps(props);
            dialog.setFooterProps(footer);
        } else {
            dialog = show_modal_dialog(props, footer);
        }
    }

    update();
    return detect().then(installed => {
        if (!installed) {
            checking_install = true;
            update();
            PK.check_missing_packages([subscriptionsClient.insightsPackage], p => {
                cancel = p.cancel;
                let pm = null;
                if (p.waiting)
                    pm = _("Waiting for other software management operations to finish");
                else
                    pm = _("Checking installed software");
                if (pm !== progress_message) {
                    progress_message = pm;
                    update();
                }
            })
                    .then(data => {
                        if (data.unavailable_names.length > 0)
                            error_message = cockpit.format(_("The $0 package is not available from any repository."),
                                                           data.unavailable_names[0]);
                        else
                            install_data = data;
                        progress_message = null;
                        cancel = null;
                        checking_install = false;
                        update();
                    })
                    .catch(e => {
                        error_message = e.toString();
                        update();
                    });
        }
    });
}

const get_monotonic_start = cockpit.spawn(
    ["/usr/libexec/platform-python", "-c",
        "import time; print(time.clock_gettime(time.CLOCK_REALTIME) - time.clock_gettime(time.CLOCK_MONOTONIC))"
    ]).then(data => {
    return parseFloat(data);
});

function calc_next_elapse(monotonic_start, timer) {
    let next_mono = Infinity; let next_real = Infinity;
    if (timer.NextElapseUSecMonotonic && monotonic_start)
        next_mono = timer.NextElapseUSecMonotonic / 1e6 + monotonic_start;
    if (timer.NextElapseUSecRealtime)
        next_real = timer.NextElapseUSecRealtime / 1e6;
    const next = Math.min(next_mono, next_real);
    if (next !== Infinity)
        return moment(next * 1000).calendar();
    else
        return _("unknown");
}

function jump_to_service() {
    cockpit.jump("/system/services#/insights-client.service", cockpit.transport.host);
}

function jump_to_timer() {
    cockpit.jump("/system/services#/insights-client.timer", cockpit.transport.host);
}

function monitor_last_upload() {
    const self = {
        timestamp: 0,
        close
    };

    cockpit.event_target(self);

    const results_file = cockpit.file("/etc/insights-client/.lastupload");
    results_file.watch(() => {
        cockpit.spawn(["stat", "-c", "%Y", "/etc/insights-client/.lastupload"], { err: "message" })
                .then(ts => {
                    self.timestamp = parseInt(ts);
                    self.dispatchEvent("changed");
                })
                .catch(() => {
                    self.timestamp = 0;
                    self.dispatchEvent("changed");
                });
    }, { read: false });

    function close() {
        results_file.close();
    }

    return self;
}

const last_upload_monitor = monitor_last_upload();

function show_status_dialog() {
    function show(monotonic_start) {
        let lastupload = last_upload_monitor.timestamp;
        const next_elapse = calc_next_elapse(monotonic_start, insights_timer.details);

        let failed_text = null;
        if (insights_service.unit.ActiveExitTimestamp &&
            insights_service.unit.ActiveExitTimestamp / 1e6 > lastupload) {
            lastupload = insights_service.unit.ActiveExitTimestamp / 1e6;
            failed_text = _("The last Insights data upload has failed.");
        }

        const dlg = show_modal_dialog(
            {
                title: _("Connected to Red Hat Insights"),
                body: (
                    <div className="modal-body">
                        <table>
                            <tbody>
                                <tr>
                                    <th>{_("Next Insights data upload")}</th>
                                    <td>{next_elapse}</td>
                                </tr>
                                { lastupload &&
                                    <tr>
                                        <th>{_("Last Insights data upload")}</th>
                                        <td>{moment(lastupload * 1000).calendar()}</td>
                                    </tr>}
                            </tbody>
                        </table>
                        <br />
                        { insights_timer.state === "failed" &&
                        <Alert variant='warning' isInline>
                            <Button variant='link' isInline onClick={left(jump_to_timer)}>{_("Details")}</Button>
                        </Alert>}
                        { (insights_service.state === "failed" || (insights_service.state === "starting" && insights_service.details.Result !== "success")) && failed_text &&
                        <Alert variant='warning' title={failed_text} isInline>
                            <Button variant='link' isInline onClick={left(jump_to_service)}>{_("Details")}</Button>
                        </Alert>}
                        <ExpandableSection toggleText={_("Disconnect from Insights")}>
                            <Alert isInline
                                variant='warning'
                                title={_("If you disconnect this system from Insights, it will no longer report its Insights status in Red Hat Cloud or Satellite.")}
                            >
                                <Button variant='danger' onClick={left(disconnect)}>
                                    {_("Disconnect from Insights")}
                                </Button>
                            </Alert>
                        </ExpandableSection>
                    </div>
                )
            },
            {
                cancel_caption: _("Close"),
                actions: []
            }
        );

        function disconnect() {
            dlg.setFooterProps(
                {
                    cancel_caption: _("Cancel"),
                    actions: [],
                    idle_message: <Spinner className="dialog-wait-ct-spinner" size="md" />,
                });
            unregister().then(
                () => {
                    dlg.footerProps.dialog_done();
                },
                error => {
                    dlg.setFooterProps(
                        {
                            cancel_caption: _("Close"),
                            actions: [],
                            static_error: error.toString()
                        });
                });
        }
    }

    get_monotonic_start.then(show).catch(err => { console.warn(err); show(null) });
}

export class InsightsStatus extends React.Component {
    constructor() {
        super();
        this.state = { };
        this.on_changed = () => { this.setState({ }) };
    }

    componentDidMount() {
        insights_timer.addEventListener("changed", this.on_changed);
        insights_service.addEventListener("changed", this.on_changed);
        last_upload_monitor.addEventListener("changed", this.on_changed);

        this.hosts_details_file = cockpit.file("/var/lib/insights/host-details.json",
                                               { syntax: JSON, superuser: true });
        this.hosts_details_file.watch(data => this.setState({ host_details: data }));
        this.insights_details_file = cockpit.file("/var/lib/insights/insights-details.json",
                                                  { syntax: JSON, superuser: true });
        this.insights_details_file.watch(data => this.setState({ insights_details: data }));
    }

    componentWillUnmount() {
        insights_timer.removeEventListener("changed", this.on_changed);
        insights_service.removeEventListener("changed", this.on_changed);
        last_upload_monitor.removeEventListener("changed", this.on_changed);

        this.hosts_details_file.close();
        this.insights_details_file.close();
    }

    render() {
        let status;

        if (insights_timer.enabled) {
            const warn = ((insights_service.state === "failed" || (insights_service.state === "starting" && insights_service.details.Result !== "success")) &&
                        insights_service.unit.ActiveExitTimestamp &&
                        insights_service.unit.ActiveExitTimestamp / 1e6 > last_upload_monitor.timestamp);

            let url;
            try {
                url = "https://console.redhat.com/insights/inventory/" + this.state.host_details.results[0].id;
            } catch (err) {
                url = "https://console.redhat.com/insights";
            }

            let text;
            try {
                const n_rule_hits = this.state.insights_details.length;
                if (n_rule_hits === 0) {
                    text = _("No rule hits");
                } else {
                    try {
                        const max_risk = Math.max(...this.state.insights_details.map(h => h.rule.total_risk));
                        // We do this all explicitly and in a long
                        // winded way so that the translation
                        // machinery gets to see all the strings.
                        if (max_risk >= 4) {
                            text = cockpit.format(cockpit.ngettext("$0 critical hit",
                                                                   "$0 hits, including critical",
                                                                   n_rule_hits),
                                                  n_rule_hits);
                        } else if (max_risk >= 3) {
                            text = cockpit.format(cockpit.ngettext("$0 important hit",
                                                                   "$0 hits, including important",
                                                                   n_rule_hits),
                                                  n_rule_hits);
                        } else if (max_risk >= 2) {
                            text = cockpit.format(cockpit.ngettext("$0 moderate hit",
                                                                   "$0 hits, including moderate",
                                                                   n_rule_hits),
                                                  n_rule_hits);
                        } else {
                            text = cockpit.format(cockpit.ngettext("$0 low severity hit",
                                                                   "$0 low severity hits",
                                                                   n_rule_hits),
                                                  n_rule_hits);
                        }
                    } catch (err) {
                        text = cockpit.format(cockpit.ngettext("$0 hit",
                                                               "$0 hits",
                                                               n_rule_hits),
                                              n_rule_hits);
                    }
                }
            } catch (err) {
                text = _("View your Insights results");
            }

            status = (
                <Stack hasGutter>
                    <StackItem>
                        <Button isInline
                            variant="link"
                            icon={warn ? <Icon status="warning"><WarningTriangleIcon /></Icon> : null}
                            onClick={left(show_status_dialog)}
                        >
                            {_("Connected to Insights")}
                        </Button>
                    </StackItem>
                    <StackItem>
                        <Button isInline
                            variant="link" component="a" href={url}
                            target="_blank" rel="noopener noreferrer"
                            icon={<ExternalLinkAltIcon />}
                        >
                            { text }
                        </Button>
                    </StackItem>
                </Stack>
            );
        } else {
            status = <Button variant="link" isInline onClick={left(show_connect_dialog)}>{_("Not connected")}</Button>;
        }

        return (
            <DescriptionListGroup>
                <DescriptionListTerm>{_("Insights")}</DescriptionListTerm>
                <DescriptionListDescription>{status}</DescriptionListDescription>
            </DescriptionListGroup>
        );
    }
}
