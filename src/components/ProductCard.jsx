import { useNavigate } from 'react-router-dom'
import { Img, StatusBadge } from './ui'
import { fmtMoney } from '../lib/format'

export default function ProductCard({ product, category }) {
  const navigate = useNavigate()
  return (
    <div className="pcard" onClick={() => navigate(`/product/${product.id}`)}>
      <div className="img-box">
        <Img src={product.image_url} alt={product.name} />
        <StatusBadge status={product.status} />
        {product.damaged && <span className="badge damaged damaged-flag">Damaged</span>}
      </div>
      <div className="body">
        {category && <div className="cat">{category}</div>}
        <div className="name" title={product.name}>{product.name}</div>
        <div className="desc">{product.description || ' '}</div>
        <div className="price">{fmtMoney(product.price)}</div>
      </div>
    </div>
  )
}
