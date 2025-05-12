/*
 * This file is part of Cockpit.
 *
 * Copyright (C) 2015 Red Hat, Inc.
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

import "cockpit-dark-theme";
import cockpit from 'cockpit';
import React from 'react';
import { createRoot } from 'react-dom/client';

import 'patternfly/patternfly-6-cockpit.scss';

import subscriptionsClient from './subscriptions-client.js';
import SubscriptionsView from './subscriptions-view.jsx';

import './subscriptions.scss';

const dataStore = { };

function initStore(rootElement) {
    const root = createRoot(rootElement);

    dataStore.render = () => {
        root.render(<SubscriptionsView />);
    };
    subscriptionsClient.init();
}

document.addEventListener("DOMContentLoaded", function() {
    cockpit.translate();
    initStore(document.getElementById('app'));
    dataStore.render();
});
