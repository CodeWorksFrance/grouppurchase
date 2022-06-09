const Purchases = require('./domain/purchases');
const purchases = new Purchases();
const calculate = require('../service/Calculator');

class PurchaseRepository {

    constructor(pool) {
        this.pool = pool;
    }

    findLatestPurchases() {
        const selectQuery = 'SELECT p.Id, u.Name, p.creation_date FROM Purchases p INNER JOIN Users u ON u.id = p.user_id ORDER BY p.creation_date DESC'
        return this.pool.query(selectQuery)
            .then(response => purchases.mapAsSummary(response.rows))
            .catch(error => {
                throw error
            })
    }

    findPurchaseItem(id) {
        const selectQuery = `SELECT distinct p.id, u.name, p.creation_date, p.shipping_fee
                             FROM Purchases p
                                      INNER JOIN Users u ON u.id = p.user_id
                             WHERE p.id = ${id}`;
        return this.pool.query(selectQuery)
            .then(async response => {
                const selectedPurchase = purchases.mapToPurchase(response.rows[0])
                const orderedItems = await this.findOrdersByUsers(id);
                orderedItems.forEach(row => {
                    purchases.createPurchaseDetail(selectedPurchase.items, row)
                });
                return selectedPurchase
            })
            .catch(error => {
                console.log("An error has occured:::", error)
                throw error
            })
    }

    findOrdersByUsers(id) {
        const userOrdersQuery = `SELECT i.label, i.quantity, i.unit_price, u.name
                                 FROM Purchase_Items i
                                          INNER JOIN Users u ON u.id = i.buyer_id
                                 WHERE i.purchase_id = ${id}`
        return this.pool.query(userOrdersQuery)
            .then(response => response.rows)
            .catch(error => {
                console.log("An error has occured:::", error)
                throw error
            })
    }

    createPurchase(payload, purchaseDetails) {
        const purchase = purchases.newPurchase(payload, purchaseDetails);
        const createNewPurchaseQuery = 'INSERT INTO PURCHASES (User_Id, Creation_Date, Shipping_Fee) SELECT u.Id, $2, $3 FROM Users as u WHERE u.name = $1 RETURNING ID;'
        let lastPurchaseId = this.pool.query(createNewPurchaseQuery, [purchase.user, purchase.purchaseDate, purchase.shippingFee])
            .then(result => {
                let purchaseId = result.rows[0].id;
                for (let i = 0; i < purchase.items.length; i++) {
                    const selectCreatedItem = 'INSERT INTO PURCHASE_ITEMS(Purchase_Id, Label, Quantity, Unit_Price, Buyer_Id) SELECT $1, $2, $3, $4, u.Id FROM Users AS u WHERE u.name = $5;'
                    return this.pool.query(selectCreatedItem, [purchaseId, purchase.items[i].label, purchase.items[i].quantity, purchase.items[i].unitPrice, purchase.items[i].buyer])
                        .then(_ => {
                            return purchaseId;
                        })
                        .catch(error => {
                            console.log("A first error has occured:::: ", error);
                            throw error;
                        });
                }
            }).catch(error => {
                console.log("An error has occured while creating a new purchase:::", error)
                throw error
            });
        return lastPurchaseId;
    }

    createPurchaseToRender(purchaseDetails) {
        return {
            purchase: purchaseDetails,
            getTotal: (items) => {
                let result = 0;
                items.forEach(item => {
                    result += item.amount
                })
                return result
            },
            bills: calculate(purchaseDetails),
            showRunningTotal: true
        }
    }
}

module.exports = PurchaseRepository;