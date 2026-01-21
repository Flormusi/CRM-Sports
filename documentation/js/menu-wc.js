'use strict';

customElements.define('compodoc-menu', class extends HTMLElement {
    constructor() {
        super();
        this.isNormalMode = this.getAttribute('mode') === 'normal';
    }

    connectedCallback() {
        this.render(this.isNormalMode);
    }

    render(isNormalMode) {
        let tp = lithtml.html(`
        <nav>
            <ul class="list">
                <li class="title">
                    <a href="index.html" data-type="index-link">Application documentation</a>
                </li>

                <li class="divider"></li>
                ${ isNormalMode ? `<div id="book-search-input" role="search"><input type="text" placeholder="Type to search"></div>` : '' }
                <li class="chapter">
                    <a data-type="chapter-link" href="index.html"><span class="icon ion-ios-home"></span>Getting started</a>
                    <ul class="links">
                        <li class="link">
                            <a href="overview.html" data-type="chapter-link">
                                <span class="icon ion-ios-keypad"></span>Overview
                            </a>
                        </li>
                        <li class="link">
                            <a href="index.html" data-type="chapter-link">
                                <span class="icon ion-ios-paper"></span>README
                            </a>
                        </li>
                                <li class="link">
                                    <a href="dependencies.html" data-type="chapter-link">
                                        <span class="icon ion-ios-list"></span>Dependencies
                                    </a>
                                </li>
                    </ul>
                </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#classes-links"' :
                            'data-bs-target="#xs-classes-links"' }>
                            <span class="icon ion-ios-paper"></span>
                            <span>Classes</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="classes-links"' : 'id="xs-classes-links"' }>
                            <li class="link">
                                <a href="classes/ApiError.html" data-type="entity-link" >ApiError</a>
                            </li>
                            <li class="link">
                                <a href="classes/BillingController.html" data-type="entity-link" >BillingController</a>
                            </li>
                            <li class="link">
                                <a href="classes/ConfigController.html" data-type="entity-link" >ConfigController</a>
                            </li>
                            <li class="link">
                                <a href="classes/ConfigController-1.html" data-type="entity-link" >ConfigController</a>
                            </li>
                            <li class="link">
                                <a href="classes/CustomerController.html" data-type="entity-link" >CustomerController</a>
                            </li>
                            <li class="link">
                                <a href="classes/CustomerController-1.html" data-type="entity-link" >CustomerController</a>
                            </li>
                            <li class="link">
                                <a href="classes/DashboardController.html" data-type="entity-link" >DashboardController</a>
                            </li>
                            <li class="link">
                                <a href="classes/DashboardController-1.html" data-type="entity-link" >DashboardController</a>
                            </li>
                            <li class="link">
                                <a href="classes/DatabaseService.html" data-type="entity-link" >DatabaseService</a>
                            </li>
                            <li class="link">
                                <a href="classes/EmailController.html" data-type="entity-link" >EmailController</a>
                            </li>
                            <li class="link">
                                <a href="classes/EmailQueueService.html" data-type="entity-link" >EmailQueueService</a>
                            </li>
                            <li class="link">
                                <a href="classes/EmailService.html" data-type="entity-link" >EmailService</a>
                            </li>
                            <li class="link">
                                <a href="classes/InvoiceController.html" data-type="entity-link" >InvoiceController</a>
                            </li>
                            <li class="link">
                                <a href="classes/MeliService.html" data-type="entity-link" >MeliService</a>
                            </li>
                            <li class="link">
                                <a href="classes/OrderController.html" data-type="entity-link" >OrderController</a>
                            </li>
                            <li class="link">
                                <a href="classes/OrderController-1.html" data-type="entity-link" >OrderController</a>
                            </li>
                            <li class="link">
                                <a href="classes/OrderService.html" data-type="entity-link" >OrderService</a>
                            </li>
                            <li class="link">
                                <a href="classes/PaymentService.html" data-type="entity-link" >PaymentService</a>
                            </li>
                            <li class="link">
                                <a href="classes/PDFController.html" data-type="entity-link" >PDFController</a>
                            </li>
                            <li class="link">
                                <a href="classes/PDFService.html" data-type="entity-link" >PDFService</a>
                            </li>
                            <li class="link">
                                <a href="classes/ProductController.html" data-type="entity-link" >ProductController</a>
                            </li>
                            <li class="link">
                                <a href="classes/ReportController.html" data-type="entity-link" >ReportController</a>
                            </li>
                            <li class="link">
                                <a href="classes/StockController.html" data-type="entity-link" >StockController</a>
                            </li>
                            <li class="link">
                                <a href="classes/StockSyncService.html" data-type="entity-link" >StockSyncService</a>
                            </li>
                            <li class="link">
                                <a href="classes/UserController.html" data-type="entity-link" >UserController</a>
                            </li>
                        </ul>
                    </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#interfaces-links"' :
                            'data-bs-target="#xs-interfaces-links"' }>
                            <span class="icon ion-md-information-circle-outline"></span>
                            <span>Interfaces</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? ' id="interfaces-links"' : 'id="xs-interfaces-links"' }>
                            <li class="link">
                                <a href="interfaces/ApiError.html" data-type="entity-link" >ApiError</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/AuthRequest.html" data-type="entity-link" >AuthRequest</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/AuthRequest-1.html" data-type="entity-link" >AuthRequest</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Client.html" data-type="entity-link" >Client</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ClientCreate.html" data-type="entity-link" >ClientCreate</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/CreateInvoice.html" data-type="entity-link" >CreateInvoice</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/EmailJob.html" data-type="entity-link" >EmailJob</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ICustomer.html" data-type="entity-link" >ICustomer</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Invoice.html" data-type="entity-link" >Invoice</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Invoice-1.html" data-type="entity-link" >Invoice</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/InvoiceDocument.html" data-type="entity-link" >InvoiceDocument</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/InvoiceItem.html" data-type="entity-link" >InvoiceItem</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/IOrder.html" data-type="entity-link" >IOrder</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/IPayment.html" data-type="entity-link" >IPayment</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/IProduct.html" data-type="entity-link" >IProduct</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/IStock.html" data-type="entity-link" >IStock</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/IStockMetrics.html" data-type="entity-link" >IStockMetrics</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Order.html" data-type="entity-link" >Order</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/OrderItem.html" data-type="entity-link" >OrderItem</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/PartialPayment.html" data-type="entity-link" >PartialPayment</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/Product.html" data-type="entity-link" >Product</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/ProductCreate.html" data-type="entity-link" >ProductCreate</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/SystemSettings.html" data-type="entity-link" >SystemSettings</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/SystemStatus.html" data-type="entity-link" >SystemStatus</a>
                            </li>
                            <li class="link">
                                <a href="interfaces/UserRequest.html" data-type="entity-link" >UserRequest</a>
                            </li>
                        </ul>
                    </li>
                    <li class="chapter">
                        <div class="simple menu-toggler" data-bs-toggle="collapse" ${ isNormalMode ? 'data-bs-target="#miscellaneous-links"'
                            : 'data-bs-target="#xs-miscellaneous-links"' }>
                            <span class="icon ion-ios-cube"></span>
                            <span>Miscellaneous</span>
                            <span class="icon ion-ios-arrow-down"></span>
                        </div>
                        <ul class="links collapse " ${ isNormalMode ? 'id="miscellaneous-links"' : 'id="xs-miscellaneous-links"' }>
                            <li class="link">
                                <a href="miscellaneous/functions.html" data-type="entity-link">Functions</a>
                            </li>
                            <li class="link">
                                <a href="miscellaneous/variables.html" data-type="entity-link">Variables</a>
                            </li>
                        </ul>
                    </li>
                    <li class="chapter">
                        <a data-type="chapter-link" href="coverage.html"><span class="icon ion-ios-stats"></span>Documentation coverage</a>
                    </li>
                    <li class="divider"></li>
                    <li class="copyright">
                        Documentation generated using <a href="https://compodoc.app/" target="_blank" rel="noopener noreferrer">
                            <img data-src="images/compodoc-vectorise.png" class="img-responsive" data-type="compodoc-logo">
                        </a>
                    </li>
            </ul>
        </nav>
        `);
        this.innerHTML = tp.strings;
    }
});