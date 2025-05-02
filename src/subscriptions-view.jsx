/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2016 Red Hat, Inc.
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

import cockpit from 'cockpit';
import React from 'react';
import subscriptionsClient from './subscriptions-client';

import { Alert, AlertActionCloseButton, AlertGroup } from '@patternfly/react-core/dist/esm/components/Alert/index.js';
import { Button } from "@patternfly/react-core/dist/esm/components/Button/index.js";
import { Card, CardBody, CardHeader, CardTitle } from "@patternfly/react-core/dist/esm/components/Card/index.js";
import {
    DescriptionList, DescriptionListDescription, DescriptionListGroup, DescriptionListTerm
} from "@patternfly/react-core/dist/esm/components/DescriptionList/index.js";
import { EmptyState, EmptyStateBody, EmptyStateVariant } from "@patternfly/react-core/dist/esm/components/EmptyState/index.js";
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { Gallery } from "@patternfly/react-core/dist/esm/layouts/Gallery/index.js";
import { Label } from "@patternfly/react-core/dist/esm/components/Label/index.js";
import { Split, SplitItem } from "@patternfly/react-core/dist/esm/layouts/Split/index.js";
import { Page, PageSection } from '@patternfly/react-core/dist/esm/components/Page/index.js';

import { InsightsStatus } from './insights.jsx';
import SubscriptionRegisterDialog from './subscriptions-register.jsx';
import { EmptyStatePanel } from "cockpit-components-empty-state.jsx";
import { ListingTable } from "cockpit-components-table.jsx";

import * as Insights from './insights.jsx';
import * as Dialog from 'cockpit-components-dialog.jsx';

const _ = cockpit.gettext;

class InstalledProducts extends React.Component {
    render() {
        const columnTitles = [_("Product name")];

        let sca_mode;

        sca_mode = false;
        if (this.props.org) {
            if ("contentAccessMode" in this.props.org) {
                if (this.props.org.contentAccessMode === "org_environment") {
                    sca_mode = true;
                }
            }
        }

        const is_registered = (this.props.status !== 'unknown');
        const entries = this.props.products.map(function (itm) {
            let status_color;
            let status_text;
            let label_status_text;
            let start_date_text;
            let end_date_text;
            let columns;

            if (itm.status === 'subscribed') {
                status_color = "green";
                label_status_text = _("Subscribed");
                status_text = label_status_text;
            } else if (itm.status === 'partially_subscribed') {
                status_color = "orange";
                label_status_text = _("Partially subscribed");
                status_text = cockpit.format(
                    _("Partially subscribed ($0)"), itm.status_details.join(',')
                );
            } else if (itm.status === 'not_subscribed') {
                status_color = "red";
                label_status_text = _("Not subscribed");
                status_text = cockpit.format(
                    _("Not subscribed ($0)"), itm.status_details.join(',')
                );
            } else {
                console.debug('Other state:', itm.status);
                status_color = "red";
                label_status_text = _("Unknown status");
                status_text = label_status_text;
            }

            if (itm.starts.length === 0) {
                start_date_text = _("Unknown");
            } else {
                start_date_text = new Date(Date.parse(itm.starts)).toLocaleDateString();
            }

            if (itm.ends.length === 0) {
                end_date_text = _("Unknown");
            } else {
                end_date_text = new Date(Date.parse(itm.ends)).toLocaleDateString();
            }

            if (sca_mode || !is_registered) {
                columns = [
                    {
                        title: (
                            <Split>
                                <SplitItem isFilled>
                                    {itm.productName}
                                </SplitItem>
                            </Split>),
                        header: true,
                    }
                ];
            } else {
                columns = [
                    {
                        title: (
                            <Split>
                                <SplitItem isFilled>
                                    {itm.productName}
                                </SplitItem>
                                <SplitItem>
                                    <Label color={status_color}>
                                        {label_status_text}
                                    </Label>
                                </SplitItem>
                            </Split>),
                        header: true,
                    }
                ];
            }

            const attr_list = [
                <DescriptionListGroup key="product_name">
                    <DescriptionListTerm>{_("Product name")}</DescriptionListTerm>
                    <DescriptionListDescription>{itm.productName}</DescriptionListDescription>
                </DescriptionListGroup>,
                <DescriptionListGroup key="product_id">
                    <DescriptionListTerm>{_("Product ID")}</DescriptionListTerm>
                    <DescriptionListDescription>{itm.productId}</DescriptionListDescription>
                </DescriptionListGroup>,
                <DescriptionListGroup key="product_version">
                    <DescriptionListTerm>{_("Version")}</DescriptionListTerm>
                    <DescriptionListDescription>{itm.version}</DescriptionListDescription>
                </DescriptionListGroup>,
                <DescriptionListGroup key="product_arch">
                    <DescriptionListTerm>{_("Arch")}</DescriptionListTerm>
                    <DescriptionListDescription>{itm.arch}</DescriptionListDescription>
                </DescriptionListGroup>
            ];

            if (!sca_mode && is_registered) {
                attr_list.push(
                    <DescriptionListGroup key="product_status">
                        <DescriptionListTerm>{_("Status")}</DescriptionListTerm>
                        <DescriptionListDescription>{status_text}</DescriptionListDescription>
                    </DescriptionListGroup>,
                    <DescriptionListGroup key="product_start_date">
                        <DescriptionListTerm>{_("Starts")}</DescriptionListTerm>
                        <DescriptionListDescription>{start_date_text}</DescriptionListDescription>
                    </DescriptionListGroup>,
                    <DescriptionListGroup key="product_end_date">
                        <DescriptionListTerm>{_("Ends")}</DescriptionListTerm>
                        <DescriptionListDescription>{end_date_text}</DescriptionListDescription>
                    </DescriptionListGroup>
                );
            }

            const body = (
                <DescriptionList isHorizontal>
                    {attr_list}
                </DescriptionList>
            );

            return ({
                props: { key: itm.productId, 'data-row-id': itm.productName },
                columns,
                hasPadding: true,
                expandedContent: body,
            });
        });

        return (
            <Card id="products" className="products" key="products">
                <CardHeader>
                    <CardTitle>{_("Installed products")}</CardTitle>
                </CardHeader>
                <CardBody className="contains-list">
                    <ListingTable aria-label={_("Installed products")}
                        variant='compact'
                        showHeader={false}
                        emptyCaption={_("No installed products detected")}
                        columns={columnTitles}
                        rows={entries}
                    />
                </CardBody>
            </Card>
        );
    }
}

/* Show subscriptions status of the system, offer to register/unregister the system
 * Expected properties:
 * status       subscription status ID
 * status_msg   subscription status message
 * error        error message to show (in Curtains if not connected, as a dismissable alert otherwise)
 * syspurpose
 * syspurpose_status
 * dismissError callback, triggered for the dismissable error in connected state
 * register     callback, triggered when user clicks on register
 * unregister   callback, triggered when user clicks on unregister
 */
class SubscriptionStatus extends React.Component {
    constructor(props) {
        super(props);
        this.handleRegisterSystem = this.handleRegisterSystem.bind(this);
        this.handleUnregisterSystem = this.handleUnregisterSystem.bind(this);
    }

    handleRegisterSystem(err) {
        // only consider primary mouse button
        if (!err || err.button !== 0)
            return;
        if (this.props.register)
            this.props.register();
        err.stopPropagation();
    }

    handleUnregisterSystem(e) {
        // only consider primary mouse button
        if (!e || e.button !== 0)
            return;
        if (this.props.unregister)
            this.props.unregister(this.addAlert);
        e.stopPropagation();
    }

    render() {
        // Try to detect SCA mode first
        let sca_mode;
        let org_name;
        sca_mode = false;
        if (this.props.org === undefined) {
            org_name = '';
        } else {
            // Organization name
            if ('displayName' in this.props.org) {
                org_name = this.props.org.displayName;
            } else {
                org_name = '';
            }
            // SCA mode tooltip
            if ('contentAccessMode' in this.props.org) {
                if (this.props.org.contentAccessMode === 'org_environment') {
                    sca_mode = true;
                }
            }
        }

        // Display system purpose only in the case, when it make sense
        let syspurpose = null;
        let syspurpose_card_body;

        const p = this.props.syspurpose;
        if (p.service_level_agreement || p.usage || p.role || p.addons) {
            syspurpose_card_body = (
                <DescriptionList isHorizontal>
                    {p.service_level_agreement &&
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Service level")}</DescriptionListTerm>
                            <DescriptionListDescription>{p.service_level_agreement}</DescriptionListDescription>
                        </DescriptionListGroup>}
                    {p.usage &&
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Usage")}</DescriptionListTerm>
                            <DescriptionListDescription>{p.usage}</DescriptionListDescription>
                        </DescriptionListGroup>}
                    {p.role &&
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Role")}</DescriptionListTerm>
                            <DescriptionListDescription>{p.role}</DescriptionListDescription>
                        </DescriptionListGroup>}
                    {p.addons &&
                        <DescriptionListGroup>
                            <DescriptionListTerm>{_("Add-ons")}</DescriptionListTerm>
                            <DescriptionListDescription>{p.addons}</DescriptionListDescription>
                        </DescriptionListGroup>}
                </DescriptionList>
            );
        } else {
            syspurpose_card_body = (
                <div>
                    <EmptyState variant={EmptyStateVariant.sm}>
                        <EmptyStateBody>
                            {_("No system purpose attributes set")}
                        </EmptyStateBody>
                    </EmptyState>
                </div>
            );
        }

        syspurpose = (
            <Card id="syspurpose" key="syspurpose" className="ct-card-info">
                <CardTitle>{_("System purpose")}</CardTitle>
                <CardBody>
                    {syspurpose_card_body}
                </CardBody>
            </Card>
        );

        let status_text;
        let action;

        if (this.props.status === 'unknown') {
            status_text = _("Not registered");
            action = (
                <Button onClick={this.handleRegisterSystem}>{_("Register")}</Button>
            );
        } else {
            const isUnregistering = (this.props.status === "unregistering");
            status_text = sca_mode ? _("Registered") : this.props.status_msg;
            action = (
                <Button isDisabled={isUnregistering}
                    isLoading={isUnregistering}
                    onClick={this.handleUnregisterSystem}
                >
                    {isUnregistering ? _("Unregistering") : _("Unregister")}
                </Button>
            );
        }

        return (
            <>
                <Card id="overview" key="overview" className={ syspurpose !== null ? "ct-card-info" : "" }>
                    <CardHeader actions={{ actions: action, hasNoOffset: false }}>
                        <CardTitle>{_("Overview")}</CardTitle>
                    </CardHeader>
                    <CardBody>
                        <DescriptionList isHorizontal>
                            <DescriptionListGroup>
                                <DescriptionListTerm>{_("Status")}</DescriptionListTerm>
                                <DescriptionListDescription>
                                    {status_text}
                                </DescriptionListDescription>
                            </DescriptionListGroup>
                            {org_name &&
                                <DescriptionListGroup>
                                    <DescriptionListTerm>{_("Organization")}</DescriptionListTerm>
                                    <DescriptionListDescription>{org_name}</DescriptionListDescription>
                                </DescriptionListGroup>}
                            {(this.props.insights_available && this.props.status !== 'unknown') && <InsightsStatus />}
                        </DescriptionList>
                    </CardBody>
                </Card>
                {syspurpose}
            </>
        );
    }
}

/* Show subscriptions status of the system and registered products, offer to register/unregister the system
 * Expected properties:
 * status       subscription status ID
 * status_msg   subscription status message
 * error        error message to show (in EmptyState if not connected, as a dismissable alert otherwise
 * dismissError callback, triggered for the dismissable error in connected state
 * products     subscribed products (properties as in subscriptions-client)
 * register     callback, triggered when user clicks on register
 * unregister   callback, triggered when user clicks on unregister
 */
class SubscriptionsView extends React.Component {
    constructor(props) {
        super(props);

        this.registerDialogDetails = {
            user: '',
            password: '',
            activation_keys: '',
            org: '',
            proxy_server: '',
            proxy_user: '',
            proxy_password: '',
            insights: true
        };

        this.state = {
            alerts: [],

            status: subscriptionsClient.subscriptionStatus.status,
            status_msg: subscriptionsClient.subscriptionStatus.status_msg,
            products:subscriptionsClient.subscriptionStatus.products,
            error: subscriptionsClient.subscriptionStatus.error,
            syspurpose: subscriptionsClient.syspurposeStatus.info,
            syspurpose_status: subscriptionsClient.syspurposeStatus.status,
            insights_available: subscriptionsClient.insightsAvailable,
            org: subscriptionsClient.org,
        };

        this.dismissStatusError = this.dismissStatusError.bind(this);
        this.registerSystem = this.registerSystem.bind(this);
        this.openRegisterDialog = this.openRegisterDialog.bind(this);
        this.unregisterSystem = this.unregisterSystem.bind(this);
        this.addAlert = this.addAlert.bind(this);
        this.removeAlert = this.removeAlert.bind(this);
        this.handleDataChanged = this.handleDataChanged.bind(this);

        this.footerProps = {
            actions: [
                {
                    clicked: this.registerSystem,
                    caption: _("Register"),
                    style: 'primary',
                },
            ]
        };
    }

    handleDataChanged() {
        this.setState({
            status: subscriptionsClient.subscriptionStatus.status,
            status_msg: subscriptionsClient.subscriptionStatus.status_msg,
            products: subscriptionsClient.subscriptionStatus.products,
            error: subscriptionsClient.subscriptionStatus.error,
            syspurpose: subscriptionsClient.syspurposeStatus.info,
            syspurpose_status: subscriptionsClient.syspurposeStatus.status,
            insights_available: subscriptionsClient.insightsAvailable,
            org: subscriptionsClient.org
        });
    }

    componentDidMount() {
        subscriptionsClient.addEventListener("dataChanged", this.handleDataChanged);
    }

    componentWillUnmount() {
        subscriptionsClient.removeEventListener("dataChanged", this.handleDataChanged);
    }

    dismissStatusError() {
        subscriptionsClient.subscriptionStatus.error = undefined;
        subscriptionsClient.dispatchEvent("dataChanged");
    }

    registerSystem(update_progress) {
        return subscriptionsClient.registerSystem(this.registerDialogDetails, update_progress).then(() => {
            if (this.registerDialogDetails.insights)
                return Insights.register(update_progress)
                        .catch((err, data) => Insights.catch_error(err, data, this.addAlert));
        });
    }

    openRegisterDialog() {
        // Read configuration file before opening register dialog
        subscriptionsClient.readConfig().then(() => {
            // set config to what was loaded and clean previous credential information
            Object.assign(this.registerDialogDetails, subscriptionsClient.config, {
                user: '',
                password: '',
                activation_keys: '',
                org: '',
                insights: true,
                insights_available: subscriptionsClient.insightsAvailable,
                insights_detected: false,
                register_method: 'account'
            });

            Insights.detect().then(installed => {
                this.registerDialogDetails.insights_detected = installed;

                // show dialog to register
                let renderDialog;
                const updatedData = (prop, value) => {
                    if (prop) {
                        this.registerDialogDetails[prop] = value;
                    }

                    this.registerDialogDetails.onChange = updatedData;

                    const dialogProps = {
                        id: 'register_dialog',
                        title: _("Register System"),
                        body: React.createElement(SubscriptionRegisterDialog, this.registerDialogDetails),
                    };

                    if (renderDialog)
                        renderDialog.setProps(dialogProps);
                    else
                        renderDialog = Dialog.show_modal_dialog(dialogProps, this.footerProps);
                };
                updatedData();
            });
        });
    }

    unregisterSystem() {
        Insights.unregister(this.addAlert).catch(() => true)
                .then(subscriptionsClient.unregisterSystem);
    }

    addAlert(title, variant, detail) {
        const newAlert = { title, variant, detail };

        this.setState((prevState) => {
            return { alerts: [...prevState.alerts, newAlert] };
        });
    }

    removeAlert(key) {
        this.setState((prevState) => {
            const alerts = prevState.alerts.filter((alert, idx) => {
                return key !== (alert.title + idx);
            });

            return { alerts };
        });
    }

    /*
     * Render a "loading" view.
     */
    renderLoading() {
        const message = _("Updating");
        const description = _("Retrieving subscription status...");
        return <EmptyStatePanel paragraph={description} loading title={message} />;
    }

    /*
     * Render an error view representing an error status & message.
     */
    renderError(status, status_msg) {
        let description;
        let message;

        if (status === "service-unavailable") {
            message = _("The rhsm service is unavailable. Make sure subscription-manager is installed and try reloading the page. Additionally, make sure that you have checked the 'Reuse my password for privileged tasks' checkbox on the login page.");
            description = _("Unable to the reach the rhsm service.");
        } else if (status === 'access-denied') {
            message = _("Access denied");
            description = _("The current user isn't allowed to access system subscription status.");
        } else {
            message = _("Unable to connect");
            description = cockpit.format(
                _("Couldn't get system subscription status. Please ensure subscription-manager is installed. Reported status: $0 ($1)"),
                status_msg,
                status,
            );
        }

        return <EmptyStatePanel icon={ExclamationCircleIcon} paragraph={description} loading={false} title={message} />;
    }

    renderSubscriptions() {
        const alerts = this.state.alerts.map((alert, idx) => {
            const title = alert.title + idx;
            return (
                <Alert key={title}
                    variant={alert.variant}
                    title={alert.title}
                    actionClose={
                        <AlertActionCloseButton onClose={() => this.removeAlert(title)} />
                    }
                >
                    {alert.detail}
                </Alert>
            );
        });

        return (
            <Page className='no-masthead-sidebar'>
                <PageSection hasBodyWrapper={false}>
                    <AlertGroup isToast>
                        {alerts}
                    </AlertGroup>
                    <Gallery className='ct-cards-grid' hasGutter>
                        <SubscriptionStatus status={this.state.status}
                            status_msg={this.state.status_msg}
                            products={this.state.products}
                            error={this.state.error}
                            syspurpose={this.state.syspurpose}
                            syspurpose_status={this.state.syspurpose_status}
                            insights_available={this.state.insights_available}
                            org={this.state.org}
                            dismissError={this.dismissStatusError}
                            register={this.openRegisterDialog}
                            unregister={this.unregisterSystem}
                            addAlert={this.addAlert}
                        />
                        <InstalledProducts status={this.state.status}
                            status_msg={this.state.status_msg}
                            products={this.state.products}
                            error={this.state.error}
                            syspurpose={this.state.syspurpose}
                            syspurpose_status={this.state.syspurpose_status}
                            insights_available={this.state.insights_available}
                            org={this.state.org}
                            dismissError={this.dismissStatusError}
                            register={this.openRegisterDialog}
                            unregister={this.unregisterSystem}
                            addAlert={this.addAlert}
                        />
                    </Gallery>
                </PageSection>
            </Page>
        );
    }

    render() {
        const status = this.state.status;
        const status_msg = this.state.status_msg;
        const loaded = subscriptionsClient.config.loaded;
        if (status === 'not-found' ||
            status === 'access-denied' ||
            status === 'service-unavailable') {
            return this.renderError(status, status_msg);
        } else if (!loaded || status === undefined) {
            return this.renderLoading();
        } else {
            return this.renderSubscriptions();
        }
    }
}

export default SubscriptionsView;
